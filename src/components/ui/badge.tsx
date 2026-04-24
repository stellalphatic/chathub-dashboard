import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[rgb(var(--accent))] text-[rgb(var(--accent-fg))]",
        secondary:
          "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--fg-muted))]",
        outline:
          "border-[rgb(var(--border))] text-[rgb(var(--fg))]",
        success:
          "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
        warning:
          "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-300",
        danger:
          "border-transparent bg-red-500/15 text-red-600 dark:text-red-300",
        gradient: "border-transparent gradient-brand text-white",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { badgeVariants };
