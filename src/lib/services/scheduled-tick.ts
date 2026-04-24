import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversation, customer, scheduledMessage, template } from "@/db/schema";
import { decideSend } from "@/lib/window-24h";
import { queueOutboundMessage } from "@/lib/services/outbound";

/**
 * Scan queued scheduled messages whose runAt is in the past and send them.
 *
 * Called by the scheduled-ticker worker (BullMQ repeatable, every minute).
 * Uses a lock column to prevent two workers from double-processing a row.
 */
export async function tickScheduled(batchSize = 100) {
  const now = new Date();
  // Pre-filter + lock in a single UPDATE … RETURNING so two workers can't
  // both claim the same rows.
  const locked = await db.execute<{ id: string }>(sql`
    WITH due AS (
      SELECT id
      FROM scheduled_message
      WHERE status = 'queued'
        AND run_at <= ${now}
        AND (locked_until IS NULL OR locked_until < ${now})
      ORDER BY run_at
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE scheduled_message sm
    SET status = 'processing',
        locked_until = NOW() + interval '5 minutes',
        attempts = attempts + 1
    FROM due
    WHERE sm.id = due.id
    RETURNING sm.id
  `);

  // postgres-js returns an Array-like with .length; .rows shape is for node-postgres.
  // Handle both safely.
  const rows: { id: string }[] = Array.isArray(locked)
    ? (locked as unknown as { id: string }[])
    : ((locked as unknown as { rows?: { id: string }[] }).rows ?? []);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const { id } of rows) {
    const [job] = await db
      .select()
      .from(scheduledMessage)
      .where(eq(scheduledMessage.id, id))
      .limit(1);
    if (!job) continue;

    try {
      // Find the conversation for (customer, channel).
      const [conv] = await db
        .select()
        .from(conversation)
        .where(
          and(
            eq(conversation.organizationId, job.organizationId),
            eq(conversation.customerId, job.customerId),
            eq(conversation.channel, job.channel),
          ),
        )
        .limit(1);

      let conversationId: string | undefined = conv?.id;
      const lastInboundAt: Date | null = conv?.lastInboundAt ?? null;

      if (!conv) {
        // Create a conversation on the fly so history exists.
        const [cust] = await db
          .select({ id: customer.id })
          .from(customer)
          .where(eq(customer.id, job.customerId))
          .limit(1);
        if (!cust) throw new Error("customer not found");
        const convId = crypto.randomUUID();
        await db.insert(conversation).values({
          id: convId,
          organizationId: job.organizationId,
          customerId: job.customerId,
          channel: job.channel,
          channelConnectionId: job.channelConnectionId ?? null,
          mode: "bot",
          status: "open",
        });
        conversationId = convId;
      }
      if (!conversationId) throw new Error("conversation missing");

      // 24h rule: if a template is required, enforce it here. If the job has
      // a raw `body` but window is closed, convert to failed (don't try).
      const decision = decideSend(job.channel, lastInboundAt);
      const usingTemplate = !!job.templateId;

      if (decision.kind === "template_required" && !usingTemplate) {
        await db
          .update(scheduledMessage)
          .set({
            status: "skipped",
            failureReason: "outside 24h window & no template",
            updatedAt: new Date(),
          })
          .where(eq(scheduledMessage.id, job.id));
        skipped++;
        continue;
      }

      if (usingTemplate) {
        const [tpl] = await db
          .select()
          .from(template)
          .where(eq(template.id, job.templateId!))
          .limit(1);
        if (!tpl || tpl.status !== "approved") {
          await db
            .update(scheduledMessage)
            .set({
              status: "failed",
              failureReason: "template missing or not approved",
              updatedAt: new Date(),
            })
            .where(eq(scheduledMessage.id, job.id));
          failed++;
          continue;
        }
      }

      const res = await queueOutboundMessage(
        {
          organizationId: job.organizationId,
          conversationId,
          sentByBot: false,
          sentByUserId: job.createdByUserId ?? null,
          templateId: job.templateId ?? undefined,
          templateVariables: (job.variables ?? {}) as Record<string, string>,
          body: job.body ?? undefined,
          channelConnectionId: job.channelConnectionId ?? undefined,
        },
        { sendNow: true },
      );

      if (res.status === "sent") {
        await db
          .update(scheduledMessage)
          .set({
            status: "sent",
            providerMessageId: res.messageId,
            updatedAt: new Date(),
          })
          .where(eq(scheduledMessage.id, job.id));
        sent++;
      } else {
        await db
          .update(scheduledMessage)
          .set({
            status: "failed",
            failureReason: res.error ?? "unknown",
            updatedAt: new Date(),
          })
          .where(eq(scheduledMessage.id, job.id));
        failed++;
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await db
        .update(scheduledMessage)
        .set({
          status: "failed",
          failureReason: err.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(scheduledMessage.id, id));
      failed++;
    }
  }

  return { claimed: rows.length, sent, failed, skipped };
}

/** Release rows whose lock expired (worker crashed mid-process). */
export async function releaseStaleLocks() {
  await db
    .update(scheduledMessage)
    .set({ status: "queued", lockedUntil: null })
    .where(
      and(
        eq(scheduledMessage.status, "processing"),
        lt(scheduledMessage.lockedUntil, new Date()),
      ),
    );
}
