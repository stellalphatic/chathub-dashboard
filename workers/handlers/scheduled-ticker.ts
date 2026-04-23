import {
  releaseStaleLocks,
  tickScheduled,
} from "../../src/lib/services/scheduled-tick";

export async function handleScheduledTicker() {
  await releaseStaleLocks();
  const res = await tickScheduled(100);
  return res;
}
