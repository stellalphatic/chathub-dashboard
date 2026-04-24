import Link from "next/link";
import {
  Bot,
  Sparkles,
  MessageCircle,
  Instagram,
  Facebook,
  BarChart3,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Languages,
  LineChart,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketingLayout } from "@/components/marketing/marketing-layout";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Bot,
    title: "AI agent with your persona",
    body:
      "Write a system prompt, tone, do's and don'ts — the agent stays on brand across every chat.",
  },
  {
    icon: Database,
    title: "RAG knowledge",
    body:
      "Upload PDFs, docs, FAQs. The bot cites and grounds answers — never hallucinates product facts.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp, IG, Messenger",
    body:
      "YCloud for WhatsApp Business API. ManyChat + Meta direct for Instagram and Messenger.",
  },
  {
    icon: Clock,
    title: "24-hour window safe",
    body:
      "Outside Meta's 24-hour customer service window? We swap in approved templates automatically.",
  },
  {
    icon: Languages,
    title: "Urdu, Hindi, English",
    body:
      "Whisper transcription honours preferred language. Urdu-first by default; customise per business.",
  },
  {
    icon: LineChart,
    title: "Analytics & usage",
    body:
      "Token spend, provider latency, response rate, escalations. Every metric you need to tune the bot.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Create the business",
    body: "Invite the client by email. Clerk sends a one-time code. Zero shared passwords.",
  },
  {
    n: "02",
    title: "Connect channels",
    body: "Paste the YCloud/ManyChat/Meta API key. Webhook auto-wires in under a minute.",
  },
  {
    n: "03",
    title: "Upload knowledge & go live",
    body: "Drop in docs, set the persona, toggle the bot on. Replies flow within seconds.",
  },
];

const TRUST = [
  { icon: ShieldCheck, label: "End-to-end encrypted secrets" },
  { icon: Zap, label: "< 2s median reply latency" },
  { icon: CheckCircle2, label: "24h-window compliant" },
];

export default function HomePage() {
  return (
    <MarketingLayout>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        {/* Decorative gradient blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[680px] w-[1200px] opacity-50 dark:opacity-70 blur-3xl animate-float-blob">
            <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-emerald-400/40" />
            <div className="absolute right-0 top-16 h-96 w-96 rounded-full bg-teal-400/30" />
            <div className="absolute left-1/3 bottom-0 h-80 w-80 rounded-full bg-blue-400/30" />
          </div>
          <div className="absolute inset-0 grid-pattern opacity-30 dark:opacity-20" />
        </div>

        <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <div className="animate-fade-up">
            <Badge variant="outline" className="mx-auto inline-flex items-center gap-1.5 px-3 py-1">
              <Sparkles className="h-3 w-3" />
              Multi-channel AI for modern teams
            </Badge>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[rgb(var(--fg))] sm:text-6xl">
              Customer conversations,{" "}
              <span className="gradient-text">fully automated.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-[rgb(var(--fg-muted))] sm:text-lg">
              ChatHub runs your WhatsApp, Instagram and Messenger inboxes with an AI agent tuned
              to your brand — grounded in your own docs, safe inside Meta's windows, and ready
              for a human the moment things get tricky.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="gradient">
                <Link href="/contact">
                  Talk to sales <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/demo">Preview the dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="stagger mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {TRUST.map((t) => (
              <div
                key={t.label}
                className="fade-up-item inline-flex items-center justify-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-xs text-[rgb(var(--fg-muted))]"
              >
                <t.icon className="h-3.5 w-3.5 text-emerald-500" />
                {t.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Channels strip ───────────────────────────────────────────────── */}
      <section className="border-y border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))]/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-6 px-4 py-8 text-xs font-medium uppercase tracking-widest text-[rgb(var(--fg-subtle))] sm:px-6">
          <span>Channels we power</span>
          <span className="h-4 w-px bg-[rgb(var(--border))]" />
          <span className="inline-flex items-center gap-1.5 text-sm normal-case tracking-normal text-[rgb(var(--fg))]">
            <MessageCircle className="h-4 w-4 text-emerald-500" /> WhatsApp Business
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm normal-case tracking-normal text-[rgb(var(--fg))]">
            <Instagram className="h-4 w-4 text-pink-500" /> Instagram Direct
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm normal-case tracking-normal text-[rgb(var(--fg))]">
            <Facebook className="h-4 w-4 text-blue-500" /> Facebook Messenger
          </span>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary">Features</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything a support team needs, in one place.
            </h2>
            <p className="mt-4 text-[rgb(var(--fg-muted))]">
              Not a chatbot widget. A tenant-aware platform with a proper inbox, CRM, templates,
              broadcasts, RAG, and analytics — with hand-off to humans when the AI isn't sure.
            </p>
          </div>
          <div className="stagger mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="fade-up-item card-hover" interactive>
                <CardContent className="flex flex-col gap-4 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-[rgb(var(--fg))]">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--fg-muted))]">
                      {f.body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative border-y border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))]/40 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary">How it works</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              From zero to live in three steps.
            </h2>
          </div>
          <div className="stagger mt-16 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="fade-up-item relative overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 card-hover"
              >
                <div className="pointer-events-none absolute -right-4 -top-4 select-none text-6xl font-bold text-[rgb(var(--accent)/0.1)]">
                  {s.n}
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--accent)/0.15)] text-sm font-semibold text-[rgb(var(--accent))]">
                  {s.n}
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-[rgb(var(--fg))]">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--fg-muted))]">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Analytics preview ────────────────────────────────────────────── */}
      <section className="py-24 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <Badge variant="secondary">Built-in analytics</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              See what every agent — AI or human — is doing.
            </h2>
            <p className="mt-4 text-[rgb(var(--fg-muted))]">
              Tokens per conversation, latency per provider, escalation rate, unread queue, and
              template approval status. Move from gut feel to numbers in the first hour.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-[rgb(var(--fg-muted))]">
              {[
                "Real-time unread + SLA timers",
                "Spend per provider (Groq / Gemini / OpenAI)",
                "Broadcast send-through funnel",
                "Per-business usage and quotas",
              ].map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[rgb(var(--accent))]" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 shadow-xl">
            <div className="rounded-2xl bg-[rgb(var(--bg-muted))] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                    Conversations today
                  </p>
                  <p className="mt-1 text-3xl font-semibold">2,418</p>
                  <p className="mt-1 text-xs text-emerald-500">↑ 14% vs yesterday</p>
                </div>
                <BarChart3 className="h-10 w-10 text-[rgb(var(--accent))]" />
              </div>
              <div className="mt-6 grid h-40 grid-cols-12 items-end gap-1.5">
                {[24, 44, 28, 52, 38, 60, 46, 70, 54, 82, 66, 94].map((h, i) => (
                  <div
                    key={i}
                    className="rounded-t-md gradient-brand opacity-80"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs">
                {[
                  { l: "Handled by bot", v: "84%", c: "text-emerald-500" },
                  { l: "Escalated", v: "11%", c: "text-amber-500" },
                  { l: "Median latency", v: "1.4s", c: "text-sky-500" },
                ].map((m) => (
                  <div
                    key={m.l}
                    className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3"
                  >
                    <p className="text-[rgb(var(--fg-subtle))]">{m.l}</p>
                    <p className={`mt-1 text-lg font-semibold ${m.c}`}>{m.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────── */}
      <section className="pb-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-10 text-center sm:p-16">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20">
              <div className="absolute -left-10 -top-20 h-72 w-72 rounded-full bg-emerald-400 blur-3xl" />
              <div className="absolute -right-10 top-10 h-72 w-72 rounded-full bg-blue-400 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Ship your WhatsApp agent this week.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[rgb(var(--fg-muted))]">
                We onboard businesses in a single session. Bring your Meta/YCloud credentials,
                leave with a live bot in production.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" variant="gradient">
                  <Link href="/contact">Book a setup call</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/pricing">See pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
