import { reconcileInboundReplies } from "../../src/lib/services/inbound-reconcile";
import {
  releaseStaleLocks,
  tickScheduled,
} from "../../src/lib/services/scheduled-tick";

export async function handleScheduledTicker() {
  await releaseStaleLocks();
  const scheduled = await tickScheduled(100);

  // Self-healing: catch any inbound bot-mode messages whose LLM reply
  // never got enqueued (e.g. transient Redis blip from the webhook side).
  // Cheap when the queue is healthy — just runs once and finds zero rows.
  let reconciled = { found: 0, enqueued: 0 };
  try {
    reconciled = await reconcileInboundReplies(50);
  } catch (e) {
    console.warn("[scheduled-ticker] reconcile failed:", e);
  }

  return { ...scheduled, reconciled };
}
