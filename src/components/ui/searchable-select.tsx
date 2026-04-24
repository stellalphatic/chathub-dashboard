"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

/**
 * Self-contained searchable dropdown.
 *
 * Designed for lists of any length — always shows a search input, a thin
 * scrollbar, keyboard arrow-key navigation, and an empty-state message.
 */
export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyLabel = "No results",
  triggerClassName,
  panelClassName,
  maxVisible = 7,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  triggerClassName?: string;
  panelClassName?: string;
  maxVisible?: number;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const current = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ""} ${o.value}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Click-outside + Escape
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Focus search on open, reset query on close
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(Math.max(0, options.findIndex((o) => o.value === value)));
      setTimeout(() => searchRef.current?.focus(), 10);
    }
  }, [open, options, value]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  function commit(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-left text-sm",
          "transition-colors hover:border-[rgb(var(--accent)/0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring)/0.6)]",
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-[rgb(var(--fg))]">
            {current?.label ?? (
              <span className="text-[rgb(var(--fg-subtle))]">{placeholder}</span>
            )}
          </span>
          {current?.hint && (
            <span className="shrink-0 text-xs text-[rgb(var(--fg-subtle))]">
              {current.hint}
            </span>
          )}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-[rgb(var(--fg-subtle))]" />
      </button>

      {open && (
        <div
          className={cn(
            "animate-scale-in absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl shadow-black/10",
            panelClassName,
          )}
          role="dialog"
        >
          <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-[rgb(var(--fg-subtle))]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const opt = filtered[activeIdx];
                  if (opt) commit(opt.value);
                }
              }}
              className="w-full bg-transparent text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--fg-subtle))] focus:outline-none"
            />
          </div>

          <ul
            id={`${id}-list`}
            role="listbox"
            className="scrollbar-thin overflow-y-auto p-1"
            style={{ maxHeight: `${maxVisible * 2.25}rem` }}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-[rgb(var(--fg-subtle))]">
                {emptyLabel}
              </li>
            ) : (
              filtered.map((opt, i) => {
                const selected = opt.value === value;
                const active = i === activeIdx;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => commit(opt.value)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                        active
                          ? "bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--fg))]"
                          : "text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]",
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate">{opt.label}</span>
                        {opt.hint && (
                          <span className="shrink-0 text-xs text-[rgb(var(--fg-subtle))]">
                            {opt.hint}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--accent))]" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
