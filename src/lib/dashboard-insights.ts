export type SentimentSlice = { label: string; count: number };

export function buildDashboardInsights(input: {
  messages24h: number;
  prevMessages24h: number;
  inbound24h: number;
  outbound24h: number;
  totalCustomers: number;
  newCustomers7d: number;
  sentiment: SentimentSlice[];
}): string[] {
  const out: string[] = [];
  const { messages24h, prevMessages24h, inbound24h, outbound24h } = input;

  if (messages24h > prevMessages24h * 1.2 && prevMessages24h > 0) {
    out.push(
      "Message volume is trending up vs. the prior 24h — watch queue depth and auto-reply coverage.",
    );
  } else if (messages24h < prevMessages24h * 0.7 && prevMessages24h > 2) {
    out.push(
      "Traffic is quieter than yesterday’s window — a good time to run follow-ups or campaigns.",
    );
  }

  const replyRatio = outbound24h / Math.max(1, inbound24h);
  if (inbound24h > 5 && replyRatio < 0.5) {
    out.push(
      "Outbound replies are low relative to inbound — consider faster handoff or canned responses in n8n.",
    );
  } else if (inbound24h > 0 && replyRatio >= 0.9) {
    out.push(
      "Reply cadence looks healthy: outbound is keeping pace with inbound volume.",
    );
  }

  if (input.newCustomers7d >= 3) {
    out.push(
      `${input.newCustomers7d} new contacts joined in the last 7 days — segment them for nurture flows.`,
    );
  }

  const neg = input.sentiment.find((s) => s.label === "negative")?.count ?? 0;
  const pos = input.sentiment.find((s) => s.label === "positive")?.count ?? 0;
  const totalSent = input.sentiment.reduce((a, s) => a + s.count, 0);
  if (totalSent > 0 && neg / totalSent > 0.2) {
    out.push(
      "Negative sentiment share is elevated — prioritize human review on those threads.",
    );
  } else if (totalSent > 0 && pos / totalSent > 0.55) {
    out.push(
      "Strong positive sentiment mix — highlight top replies as templates for the bot.",
    );
  }

  if (input.totalCustomers > 0 && messages24h === 0) {
    out.push(
      "No messages in the last 24h while CRM has contacts — verify WhatsApp / ingest is connected.",
    );
  }

  if (out.length === 0) {
    out.push(
      "Connect n8n ingest and sentiment labels to unlock richer, automated insights on this panel.",
    );
  }

  return out.slice(0, 5);
}

export function fillLastNDaysVolume(
  countsByDay: Map<string, number>,
  days: number,
): { label: string; count: number; iso: string }[] {
  const result: { label: string; count: number; iso: string }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    d.setUTCHours(12, 0, 0, 0);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    result.push({ iso, label, count: countsByDay.get(iso) ?? 0 });
  }
  return result;
}

export function bucketMessageDates(
  dates: { createdAt: Date }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const { createdAt } of dates) {
    const iso = createdAt.toISOString().slice(0, 10);
    map.set(iso, (map.get(iso) ?? 0) + 1);
  }
  return map;
}
