"use client";

import { cn } from "@/lib/utils";

/**
 * TriChat / ChatHub brand mark.
 *
 * Three rising chat bubbles → a subtle "TriChat" glyph inside a rounded
 * futuristic container. Fully self-contained SVG — works at 16px (favicon)
 * all the way to 80px (hero marks).
 *
 * Props:
 *  - `size`      — pixel size of the mark (default 32)
 *  - `animated`  — show the hover pulse animation (default true)
 *  - `showWord`  — render the "ChatHub" wordmark to the right
 *  - `wordClassName` — override word styles (inherits currentColor)
 */
export function BrandLogo({
  size = 32,
  animated = true,
  showWord = false,
  wordClassName,
  className,
}: {
  size?: number;
  animated?: boolean;
  showWord?: boolean;
  wordClassName?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("group inline-flex items-center gap-2", className)}
      aria-label="ChatHub"
    >
      <BrandMark size={size} animated={animated} />
      {showWord && (
        <span
          className={cn(
            "font-semibold tracking-tight text-[rgb(var(--fg))]",
            wordClassName,
          )}
        >
          Chat<span className="gradient-text">Hub</span>
        </span>
      )}
    </span>
  );
}

export function BrandMark({
  size = 32,
  animated = true,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        animated && "transition-transform group-hover:scale-[1.04]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="drop-shadow-[0_6px_18px_rgb(16_185_129/0.35)]"
      >
        <defs>
          <linearGradient id="ch-brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--brand-from))" />
            <stop offset="50%" stopColor="rgb(var(--brand-via))" />
            <stop offset="100%" stopColor="rgb(var(--brand-to))" />
          </linearGradient>
          <linearGradient id="ch-brand-soft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--brand-from) / 0.22)" />
            <stop offset="100%" stopColor="rgb(var(--brand-to) / 0.05)" />
          </linearGradient>
          <filter id="ch-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="10"
          fill="url(#ch-brand)"
        />
        <rect
          x="2.5"
          y="2.5"
          width="35"
          height="35"
          rx="9.5"
          fill="url(#ch-brand-soft)"
          opacity="0.9"
        />

        <g filter="url(#ch-glow)">
          {/* Large bubble */}
          <path
            d="M10 13.5a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6.5a4 4 0 0 1-4 4h-8l-4 3.5v-3.5H14a4 4 0 0 1-4-4v-6.5z"
            fill="white"
            fillOpacity="0.96"
          />
          {/* Triangle of dots → "Tri" accent */}
          <circle
            cx="20"
            cy="14.5"
            r="1.55"
            fill="rgb(var(--brand-from))"
            className={animated ? "brand-dot brand-dot-1" : undefined}
          />
          <circle
            cx="16"
            cy="19"
            r="1.55"
            fill="rgb(var(--brand-via))"
            className={animated ? "brand-dot brand-dot-2" : undefined}
          />
          <circle
            cx="24"
            cy="19"
            r="1.55"
            fill="rgb(var(--brand-to))"
            className={animated ? "brand-dot brand-dot-3" : undefined}
          />
        </g>

        {/* Outer highlight */}
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="10"
          fill="none"
          stroke="white"
          strokeOpacity="0.18"
        />
      </svg>
    </span>
  );
}

export default BrandLogo;
