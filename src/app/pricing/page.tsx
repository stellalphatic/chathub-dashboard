import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Pricing — ChatHub" };

const TIERS = [
  {
    name: "Starter",
    price: "$199",
    blurb: "One business, one WhatsApp number, one AI agent.",
    features: [
      "1,000 AI-answered conversations / mo",
      "10,000 outbound template sends",
      "500 MB RAG knowledge",
      "Email support",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$499",
    blurb: "Multi-channel scale for growing brands.",
    features: [
      "10,000 AI conversations / mo",
      "100,000 template sends",
      "5 GB knowledge, 3 channels",
      "Priority support + onboarding",
    ],
    cta: "Book onboarding",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Talk",
    blurb: "Unlimited volume with SLA and dedicated infra.",
    features: [
      "Unlimited conversations",
      "Private Clerk + Supabase",
      "Dedicated worker cluster",
      "99.95% SLA + on-call",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[1000px] opacity-30 blur-3xl">
            <div className="absolute left-0 top-0 h-56 w-56 rounded-full bg-emerald-400/40" />
            <div className="absolute right-0 top-8 h-72 w-72 rounded-full bg-blue-400/30" />
          </div>
          <div className="absolute inset-0 grid-pattern opacity-20" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Simple, transparent pricing
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              One price per business.
            </h1>
            <p className="mt-4 text-lg text-[rgb(var(--fg-muted))]">
              No per-seat fees, no surprise tokens. Pay for what your customers send you.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-6 md:grid-cols-3">
            {TIERS.map((t) => (
              <Card
                key={t.name}
                className={`fade-up-item card-hover ${
                  t.highlighted ? "border-[rgb(var(--accent))] glow-ring" : ""
                }`}
              >
                <CardContent className="flex h-full flex-col gap-6 p-6">
                  <div>
                    {t.highlighted ? (
                      <Badge variant="gradient" className="mb-2">Most popular</Badge>
                    ) : (
                      <Badge variant="secondary" className="mb-2">{t.name}</Badge>
                    )}
                    <p className="text-3xl font-semibold tracking-tight">
                      {t.price}
                      {t.price.startsWith("$") ? (
                        <span className="text-base font-medium text-[rgb(var(--fg-subtle))]">/mo</span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-sm text-[rgb(var(--fg-muted))]">{t.blurb}</p>
                  </div>
                  <ul className="flex-1 space-y-2 text-sm">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[rgb(var(--fg-muted))]">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--accent))]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant={t.highlighted ? "gradient" : "secondary"}>
                    <Link href="/contact">{t.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-[rgb(var(--fg-subtle))]">
            All plans include WhatsApp + Instagram + Messenger, analytics, and unlimited staff seats.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
