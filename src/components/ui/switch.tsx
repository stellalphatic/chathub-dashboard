"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onCheckedChange?: (value: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  id?: string;
  className?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
  id,
  className,
}: SwitchProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex cursor-pointer items-start gap-3 select-none",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        id={inputId}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring)/0.5)]",
          checked
            ? "bg-[rgb(var(--accent))]"
            : "bg-[rgb(var(--border-strong))]",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label ? (
            <span className="block text-sm font-medium text-[rgb(var(--fg))]">
              {label}
            </span>
          ) : null}
          {description ? (
            <span className="mt-0.5 block text-xs text-[rgb(var(--fg-muted))]">
              {description}
            </span>
          ) : null}
        </span>
      )}
    </label>
  );
}
