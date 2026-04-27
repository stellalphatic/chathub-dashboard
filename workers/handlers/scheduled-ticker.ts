import { reconcilePendingDocuments } from "../../src/lib/services/document-reconcile";
import { reconcileInboundReplies } from "../../src/lib/services/inbound-reconcile";
import {
  releaseStaleLocks,
  tickScheduled,
} from "../../src/lib/services/scheduled-tick";

export async function handleScheduledTicker() {
  await releaseStaleLocks();
  const scheduled = await tickScheduled(100);

  // Self-healing on every minute tick: catch inbound replies + pending
  // documents that never got their job enqueued. Cheap when healthy.
  const reconcileResults = { messages: { found: 0, enqueued: 0 }, docs: { found: 0, enqueued: 0 } };
  try {
    reconcileResults.messages = await reconcileInboundReplies(50);
  } catch (e) {
    console.warn("[scheduled-ticker] message reconcile failed:", e);
  }
  try {
    reconcileResults.docs = await reconcilePendingDocuments(25);
  } catch (e) {
    console.warn("[scheduled-ticker] doc reconcile failed:", e);
  }

  return { ...scheduled, ...reconcileResults };
}
