import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { demoSentiment, demoStats } from "@/lib/demo-data";

export default function DemoDashboardPage() {
  const stats = [
    { label: "Customers", value: demoStats.totalCustomers, sub: "total in CRM" },
    { label: "Messages (24h)", value: demoStats.messages24h, sub: "in + out" },
    { label: "Inbound (24h)", value: demoStats.inbound24h, sub: "from WhatsApp" },
    { label: "Outbound (24h)", value: demoStats.outbound24h, sub: "bot / agent" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{s.value}</p>
              <p className="mt-1 text-xs text-zinc-500">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sentiment (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {demoSentiment.map((row) => (
              <div
                key={row.label}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {row.label}
                </p>
                <p className="text-xl font-semibold tabular-nums">{row.count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
