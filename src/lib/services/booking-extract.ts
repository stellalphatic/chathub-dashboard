import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conversation, customer, handoff } from "@/db/schema";
import { llmComplete } from "@/lib/llm/router";
import type { LlmMessage } from "@/lib/llm/types";

/**
 * Booking / appointment auto-extraction.
 *
 * After every successful bot reply we run a tiny "did the user just confirm
 * a meeting?" classifier. When confirmed, we update the customer row so
 * sales sees the booking in CRM without anyone touching it manually.
 *
 * Implementation notes:
 *   - Cheap call: temperature 0, 150 token cap, JSON-mode prompt.
 *   - Best-effort: any failure (parse, model, network) is logged + ignored.
 *     The reply has already been delivered — we don't gate on this.
 *   - Idempotent: writes only when the booking is materially different
 *     from what's already stored (saves DB churn + audit noise).
 */

export type ExtractedBooking = {
  confirmed: boolean;
  /** ISO datetime ("2026-05-03T15:00:00") in the user's local time, or null. */
  datetime?: string | null;
  /** Human-readable summary the LLM returned, e.g. "Saturday, 3 PM at the showroom". */
  summary?: string | null;
};

const SYSTEM = `You are a booking detector. Read the most recent assistant reply
in a customer-support conversation and decide whether the assistant just
*confirmed* a specific in-person meeting / showroom visit / appointment with
the customer (NOT just suggested one).

A booking is CONFIRMED only when ALL of:
- The assistant uses confirming language (e.g. "see you", "booked", "confirmed",
  "I've reserved", or restates the agreed time/day as final).
- A specific weekday or date is named.
- A specific time-of-day is named (or implied like "morning" -> not specific
  enough; "10 AM" -> specific).

If any of those is missing, set confirmed=false.

Output ONLY a JSON object on a single line, NO code fences, NO commentary:
{"confirmed":<bool>,"datetime":"<ISO 8601 or null>","summary":"<short string or null>"}

If you cannot infer a real ISO datetime (e.g. only a weekday given, no
absolute date), set datetime=null and put the natural phrase in "summary".

Today's reference date will be provided.`;

export async function extractBookingFromReply(opts: {
  organizationId: string;
  conversationId: string;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  /** ISO yyyy-mm-dd of "today" so the model can resolve "Saturday". */
  todayISO: string;
}): Promise<ExtractedBooking> {
  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Today is ${opts.todayISO}.\n\nLast 6 turns:\n${opts.recentTurns
        .slice(-6)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n")}\n\nReturn the JSON now.`,
    },
  ];

  try {
    const out = await llmComplete(
      {
        messages,
        temperature: 0,
        maxOutputTokens: 150,
        timeoutMs: 8_000,
      },
      {
        organizationId: opts.organizationId,
        conversationId: opts.conversationId,
        purpose: "classify",
      },
    );
    const text = (out.text ?? "").trim();
    return parseBookingJson(text);
  } catch (e) {
    console.warn("[booking-extract] llm failed:", (e as Error).message);
    return { confirmed: false };
  }
}

function parseBookingJson(text: string): ExtractedBooking {
  // Tolerate markdown fences / leading prose by extracting the first JSON object.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { confirmed: false };
  try {
    const obj = JSON.parse(match[0]) as {
      confirmed?: unknown;
      datetime?: unknown;
      summary?: unknown;
    };
    return {
      confirmed: obj.confirmed === true,
      datetime:
        typeof obj.datetime === "string" && obj.datetime.trim()
          ? obj.datetime.trim()
          : null,
      summary:
        typeof obj.summary === "string" && obj.summary.trim()
          ? obj.summary.trim()
          : null,
    };
  } catch {
    return { confirmed: false };
  }
}

/**
 * Persist a confirmed booking to the customer row + an audit handoff event.
 * Idempotent: if the same datetime/summary is already stored, no-op.
 */
export async function persistBooking(opts: {
  organizationId: string;
  conversationId: string;
  customerId: string;
  booking: ExtractedBooking;
}): Promise<{ stored: boolean }> {
  if (!opts.booking.confirmed) return { stored: false };

  const meetingTime =
    opts.booking.datetime || opts.booking.summary || null;
  if (!meetingTime) return { stored: false };

  const [cust] = await db
    .select({
      id: customer.id,
      meetingBooked: customer.meetingBooked,
      meetingTime: customer.meetingTime,
    })
    .from(customer)
    .where(eq(customer.id, opts.customerId))
    .limit(1);
  if (!cust) return { stored: false };

  // No-op if we already stored this exact slot
  if (cust.meetingBooked && cust.meetingTime === meetingTime) {
    return { stored: false };
  }

  await db
    .update(customer)
    .set({
      meetingBooked: true,
      meetingTime,
      status: "follow_up",
      updatedAt: new Date(),
    })
    .where(eq(customer.id, opts.customerId));

  // Audit: emit a handoff-style event so it appears in any audit/timeline UI.
  try {
    const { randomUUID } = await import("crypto");
    await db.insert(handoff).values({
      id: randomUUID(),
      organizationId: opts.organizationId,
      conversationId: opts.conversationId,
      reason: `booking_confirmed:${meetingTime}`,
      fromMode: "bot",
      toMode: "bot",
    });
  } catch {
    /* audit insert is best-effort */
  }

  console.log(
    `[booking-extract] stored booking for customer=${opts.customerId} time=${meetingTime}`,
  );
  return { stored: true };
}
