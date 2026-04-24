import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-logo";

const GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security", href: "/security" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link href="/" className="group flex items-center gap-2 font-semibold">
              <BrandMark size={32} />
              <span>
                Chat<span className="gradient-text">Hub</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-[rgb(var(--fg-muted))]">
              Multi-channel WhatsApp, Instagram and Messenger automation for modern businesses —
              with a built-in AI agent, RAG knowledge, analytics, and hand-off to humans.
            </p>
            <p className="mt-4 text-xs text-[rgb(var(--fg-subtle))]">
              © {new Date().getFullYear()} ChatHub. All rights reserved.
            </p>
          </div>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                {g.title}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[rgb(var(--fg-muted))] transition-colors hover:text-[rgb(var(--fg))]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
