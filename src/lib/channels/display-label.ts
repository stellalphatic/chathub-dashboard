/** Human-readable “our account” line for Integrations + Inbox chrome. */
export function formatBusinessChannelLabel(row: {
  provider: string;
  channel: string;
  config: Record<string, unknown> | null;
  externalId: string | null;
}): string {
  const cfg = (row.config ?? {}) as Record<string, unknown>;

  if (row.provider === "ycloud" && typeof cfg.fromPhoneE164 === "string" && cfg.fromPhoneE164) {
    return `Business WhatsApp: ${cfg.fromPhoneE164}`;
  }
  if (row.provider === "syrow" && typeof cfg.fromPhoneE164 === "string" && cfg.fromPhoneE164) {
    return `Business WhatsApp: ${cfg.fromPhoneE164}`;
  }

  if (row.provider === "meta" && row.channel === "instagram") {
    const u = cfg.instagramUsername;
    const n = cfg.instagramBusinessName;
    if (typeof u === "string" && u.trim()) {
      const handle = u.trim().replace(/^@/, "");
      return n && typeof n === "string"
        ? `Business Instagram: @${handle} (${String(n).trim()})`
        : `Business Instagram: @${handle}`;
    }
    if (typeof n === "string" && n.trim()) {
      return `Business Instagram: ${n.trim()}`;
    }
    if (row.externalId) return `Business Instagram ID: ${row.externalId}`;
    return "Business: Instagram";
  }

  if (row.provider === "meta" && row.channel === "messenger") {
    if (typeof cfg.pageName === "string" && cfg.pageName.trim()) {
      return `Business Page: ${cfg.pageName.trim()}`;
    }
    if (typeof cfg.pageId === "string" && cfg.pageId.trim()) {
      return `Business Page ID: ${cfg.pageId.trim()}`;
    }
    return "Business: Messenger";
  }

  return `${row.provider} · ${row.channel}`;
}
