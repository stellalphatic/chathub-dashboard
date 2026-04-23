import type { Job } from "bullmq";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/db";
import {
  broadcast,
  customer,
  scheduledMessage,
} from "../../src/db/schema";
import type { BroadcastRunnerJob } from "../../src/lib/queue";

/**
 * Expand the audience of a broadcast into scheduled_message rows. The
 * scheduled ticker will then send them one by one (rate-limited + 24h-safe).
 *
 * Audience matching is intentionally simple for Phase 1:
 *   audience: { tags?: string[]; statuses?: string[]; limit?: number }
 */
export async function handleBroadcastRunner(job: Job<BroadcastRunnerJob>) {
  const { organizationId, broadcastId } = job.data;
  const [bc] = await db
    .select()
    .from(broadcast)
    .where(
      and(
        eq(broadcast.id, broadcastId),
        eq(broadcast.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!bc) return { error: "broadcast missing" };
  if (bc.status !== "scheduled" && bc.status !== "running") {
    return { skipped: true, reason: `status=${bc.status}` };
  }

  await db
    .update(broadcast)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(broadcast.id, broadcastId));

  const audience = (bc.audience ?? {}) as {
    tags?: string[];
    statuses?: string[];
    limit?: number;
  };

  // Pull eligible customers. (Tag filtering happens in memory since tags is
  // JSONB; for large fleets switch to a GIN index + Postgres array ops.)
  let rows = await db
    .select()
    .from(customer)
    .where(eq(customer.organizationId, organizationId));

  if (audience.statuses && audience.statuses.length) {
    const set = new Set(audience.statuses);
    rows = rows.filter((r) => set.has(r.status));
  }
  if (audience.tags && audience.tags.length) {
    const needed = new Set(audience.tags);
    rows = rows.filter((r) => {
      const tags = (r.tags ?? []) as string[];
      return tags.some((t) => needed.has(t));
    });
  }
  if (audience.limit) rows = rows.slice(0, audience.limit);

  let enqueued = 0;
  const now = new Date();
  const defaults = (bc.defaultVariables ?? {}) as Record<string, string>;

  // Drop into scheduled_message with runAt=now so the ticker sends them.
  const batch: (typeof scheduledMessage.$inferInsert)[] = rows.map((c) => ({
    id: randomUUID(),
    organizationId,
    broadcastId,
    customerId: c.id,
    channel: bc.channel,
    channelConnectionId: bc.channelConnectionId ?? null,
    templateId: bc.templateId ?? null,
    variables: defaults,
    runAt: now,
    status: "queued",
    createdByUserId: bc.createdByUserId ?? null,
    createdAt: now,
    updatedAt: now,
  }));

  for (let i = 0; i < batch.length; i += 500) {
    await db.insert(scheduledMessage).values(batch.slice(i, i + 500));
    enqueued += Math.min(500, batch.length - i);
  }

  await db
    .update(broadcast)
    .set({
      status: "completed",
      completedAt: new Date(),
      sentCount: enqueued,
    })
    .where(eq(broadcast.id, broadcastId));

  return { enqueued };
}
