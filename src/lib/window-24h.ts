/**
 * WhatsApp 24-hour Customer Service Window rules.
 *
 *   - Inside 24h of the last inbound message: we can send ANY content (text, media).
 *   - Outside 24h: ONLY an approved template message is allowed.
 *
 * Meta enforces this via policy + error codes, not just date math — but doing
 * it ourselves on the client saves an entire round-trip and lets us schedule
 * outreach correctly.
 */

export const WA_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithin24h(lastInboundAt: Date | null | undefined): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() < WA_WINDOW_MS;
}

export type SendDecision =
  | { kind: "freeform"; reason: "within_24h" }
  | { kind: "template_required"; reason: "outside_24h" | "no_prior_inbound" };

export function decideSend(
  channel: string,
  lastInboundAt: Date | null | undefined,
): SendDecision {
  // Only WhatsApp enforces the 24h rule at the network level. IG/Messenger
  // have their own 24h rule (no templates) — we still enforce it to be safe
  // but the app-level gate differs.
  if (channel === "whatsapp") {
    if (isWithin24h(lastInboundAt)) {
      return { kind: "freeform", reason: "within_24h" };
    }
    return {
      kind: "template_required",
      reason: lastInboundAt ? "outside_24h" : "no_prior_inbound",
    };
  }
  // IG / Messenger: freeform OK in the 24h window; outside, ManyChat tags or
  // human intervention is required. We keep it freeform here; providers will
  // reject if policy blocks it, and we record the error.
  return { kind: "freeform", reason: "within_24h" };
}

/** UI-friendly label. */
export function windowLabel(lastInboundAt: Date | null | undefined) {
  if (!lastInboundAt) return "no customer message yet";
  const ms = Date.now() - lastInboundAt.getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (ms < WA_WINDOW_MS) {
    const remaining = 24 - hours;
    return `${remaining}h left in 24h window`;
  }
  const days = Math.floor(hours / 24);
  return `window closed ${days}d ago — template required`;
}
