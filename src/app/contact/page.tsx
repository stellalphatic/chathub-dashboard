import Link from "next/link";
import { Mail, MessageCircle, ShieldCheck, ArrowRight } from "lucide-react";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Contact — ChatHub" };

const OPTIONS = [
  {
    icon: Mail,
    title: "Talk to sales",
    blurb: "30 min demo tailored to your volume and channels.",
    href: "mailto:sales@clona.site",
    cta: "sales@clona.site",
  },
  {
    icon: MessageCircle,
    title: "Support",
    blurb: "Existing customers — we reply within one business day.",
    href: "mailto:support@clona.site",
    cta: "support@clona.site",
  },
  {
    icon: ShieldCheck,
    title: "Security & compliance",
    blurb: "Responsible disclosure and compliance questionnaires.",
    href: "mailto:security@clona.site",
    cta: "security@clona.site",
  },
];

export default function ContactPage() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[380px] w-[900px] opacity-30 blur-3xl">
            <div className="absolute left-0 top-0 h-56 w-56 rounded-full bg-emerald-400/40" />
            <div className="absolute right-0 top-6 h-64 w-64 rounded-full bg-blue-400/30" />
          </div>
          <div className="absolute inset-0 grid-pattern opacity-20" />
        </div>

        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline">Contact</Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Let's build the right setup for your team.
            </h1>
            <p className="mt-4 text-[rgb(var(--fg-muted))]">
              Tell us a little about your volume, channels, and goals — we'll come back with a
              concrete onboarding plan within 24 hours.
            </p>
          </div>

          <div className="stagger mt-14 grid gap-6 md:grid-cols-3">
            {OPTIONS.map((o) => (
              <Card key={o.title} className="fade-up-item card-hover">
                <CardContent className="flex flex-col gap-4 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
                    <o.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">{o.title}</h3>
                    <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">{o.blurb}</p>
                  </div>
                  <Button asChild variant="secondary" size="sm">
                    <a href={o.href}>
                      {o.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-14 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight">Already a customer?</h2>
            <p className="mt-2 text-[rgb(var(--fg-muted))]">
              Jump straight into your dashboard.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="gradient">
                <Link href="/sign-in?redirect_url=%2Fapp">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/demo">Preview the demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
