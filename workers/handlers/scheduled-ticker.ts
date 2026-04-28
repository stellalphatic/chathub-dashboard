import { tickScheduledBroadcasts } from "../../src/lib/services/broadcast-tick";
import { reconcilePendingDocuments } from "../../src/lib/services/document-reconcile";
import { reconcileInboundReplies } from "../../src/lib/services/inbound-reconcile";
import {
  releaseStaleLocks,
  tickScheduled,
} from "../../src/lib/services/scheduled-tick";

export async function handleScheduledTicker() {
  await releaseStaleLocks();
  const scheduled = await tickScheduled(100);

  // Self-healing on every minute tick: catch inbound replies, pending
  // documents, and scheduled broadcasts that haven't started yet. Cheap
  // when healthy — each runs a single short SQL.
  const reconcileResults = {
    messages: { found: 0, enqueued: 0 },
    docs: { found: 0, enqueued: 0 },
    broadcasts: { found: 0, enqueued: 0 },
  };
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
  try {
    reconcileResults.broadcasts = await tickScheduledBroadcasts(10);
  } catch (e) {
    console.warn("[scheduled-ticker] broadcast tick failed:", e);
  }

  return { ...scheduled, ...reconcileResults };
}
