import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  QUEUES,
  safeEnqueue,
  type BroadcastRunnerJob,
} from "@/lib/queue";

/**
 * Scheduled broadcast dispatcher. Looks for broadcasts whose
 * `scheduledFor` is in the past and whose worker hasn't started yet
 * (`startedAt IS NULL`). Picks up + enqueues them in one atomic update.
 *
 * Runs from the worker's slow tick (every 60 s) — fast tick doesn't need
 * to handle this since broadcast scheduling has minute-level granularity.
 */
export async function tickScheduledBroadcasts(batchSize = 10): Promise<{
  found: number;
  enqueued: number;
}> {
  const rows = await db.execute<{
    id: string;
    organization_id: string;
  }>(sql`
    WITH due AS (
      SELECT id, organization_id
      FROM broadcast
      WHERE status = 'scheduled'
        AND started_at IS NULL
        AND scheduled_for IS NOT NULL
        AND scheduled_for <= NOW()
      ORDER BY scheduled_for
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE broadcast
    SET status = 'running', started_at = NOW()
    FROM due
    WHERE broadcast.id = due.id
    RETURNING broadcast.id, broadcast.organization_id;
  `);

  type Row = { id: string; organization_id: string };
  const list: Row[] = Array.isArray(rows)
    ? (rows as unknown as Row[])
    : ((rows as unknown as { rows?: Row[] }).rows ?? []);

  let enqueued = 0;
  for (const r of list) {
    const job: BroadcastRunnerJob = {
      organizationId: r.organization_id,
      broadcastId: r.id,
    };
    const res = await safeEnqueue(QUEUES.broadcastRunner, job, {
      jobId: `bc_tick_${r.id}`,
    });
    if (res.ok) enqueued++;
  }

  if (list.length > 0) {
    console.log(
      `[broadcast-tick] scheduled-due found=${list.length} enqueued=${enqueued}`,
    );
  }
  return { found: list.length, enqueued };
}
