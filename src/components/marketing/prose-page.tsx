import { MarketingLayout } from "./marketing-layout";
import { Badge } from "@/components/ui/badge";

export function ProsePage({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[320px] w-[900px] opacity-30 blur-3xl">
            <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-emerald-400/40" />
            <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-blue-400/30" />
          </div>
          <div className="absolute inset-0 grid-pattern opacity-20" />
        </div>
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
          {eyebrow ? (
            <Badge variant="outline" className="mb-4 animate-fade-up">
              {eyebrow}
            </Badge>
          ) : null}
          <h1 className="animate-fade-up text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-4 animate-fade-up text-lg text-[rgb(var(--fg-muted))]">{subtitle}</p>
          ) : null}
          <div className="prose mt-10 max-w-none text-[rgb(var(--fg-muted))]">
            <div className="space-y-8 text-base leading-relaxed [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[rgb(var(--fg))] [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[rgb(var(--fg))] [&_p]:text-[rgb(var(--fg-muted))] [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul>li]:my-1 [&_a]:text-[rgb(var(--accent))] [&_a]:underline-offset-4 hover:[&_a]:underline">
              {children}
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
