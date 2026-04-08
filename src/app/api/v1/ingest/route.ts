import { randomUUID, timingSafeEqual } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customer, message, organization } from "@/db/schema";

export const runtime = "nodejs";

const bodySchema = z.object({
  phoneE164: z.string().min(4),
  displayName: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]),
  body: z.string(),
  providerMessageId: z.string().optional(),
  meetingBooked: z.boolean().optional(),
  meetingTime: z.string().optional(),
  sentiment: z.enum(["positive", "negative", "neutral"]).optional(),
  rawPayload: z.record(z.unknown()).optional(),
});

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function POST(request: Request) {
  const orgSlug = request.headers.get("x-chathub-org")?.trim();
  const secret = request.headers.get("x-chathub-secret")?.trim();
  if (!orgSlug || !secret) {
    return NextResponse.json(
      { error: "Missing X-ChatHub-Org or X-ChatHub-Secret" },
      { status: 401 },
    );
  }

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, orgSlug))
    .limit(1);

  if (!org || !safeEqual(secret, org.ingestSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const providerMessageId =
    data.providerMessageId?.trim() || undefined;

  if (providerMessageId) {
    const [existing] = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(
          eq(message.organizationId, org.id),
          eq(message.providerMessageId, providerMessageId),
        ),
      )
      .limit(1);
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true, id: existing.id });
    }
  }

  const now = new Date();
  const customerId = randomUUID();

  await db
    .insert(customer)
    .values({
      id: customerId,
      organizationId: org.id,
      phoneE164: data.phoneE164,
      displayName: data.displayName ?? null,
      lastContactedAt: now,
      meetingBooked: data.meetingBooked ?? false,
      meetingTime: data.meetingTime ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [customer.organizationId, customer.phoneE164],
      set: {
        lastContactedAt: now,
        updatedAt: now,
        ...(data.displayName !== undefined
          ? { displayName: data.displayName }
          : {}),
        ...(data.meetingBooked !== undefined
          ? { meetingBooked: data.meetingBooked }
          : {}),
        ...(data.meetingTime !== undefined ? { meetingTime: data.meetingTime } : {}),
      },
    });

  const [row] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(
      and(
        eq(customer.organizationId, org.id),
        eq(customer.phoneE164, data.phoneE164),
      ),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Customer upsert failed" }, { status: 500 });
  }

  const messageId = randomUUID();
  try {
    await db.insert(message).values({
      id: messageId,
      organizationId: org.id,
      customerId: row.id,
      direction: data.direction,
      body: data.body,
      providerMessageId: providerMessageId ?? null,
      sentiment: data.sentiment ?? null,
      rawPayload: data.rawPayload ?? null,
      createdAt: now,
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw e;
  }

  return NextResponse.json({ ok: true, id: messageId, customerId: row.id });
}
