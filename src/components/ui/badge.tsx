import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Brand surfaces retain semantic colors for success, warning, and errors.
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:focus:ring-white/30",
  {
    variants: {
      variant: {
        default:
          "border-brand-navy/20 bg-secondary text-brand-navy dark:border-slate-600 dark:bg-slate-900 dark:text-white",
        secondary:
          "border-brand-orange/20 bg-brand-tint text-brand-navy dark:border-orange-800 dark:bg-slate-900 dark:text-orange-200",
        outline:
          "border-black/15 bg-transparent text-black dark:border-white/20 dark:text-white",
        destructive:
          "border-2 border-black bg-white text-black underline decoration-2 underline-offset-2 dark:border-white dark:bg-black dark:text-white",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        warning:
          "border-orange-200 bg-brand-tint text-orange-900 dark:border-orange-800 dark:bg-slate-900 dark:text-orange-200",
        info:
          "border-blue-200 bg-blue-50 text-brand-navy dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200",
        muted:
          "border-black/10 bg-neutral-50 text-neutral-600 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300",
        danger:
          "border-2 border-black bg-white text-black underline decoration-2 underline-offset-2 dark:border-white dark:bg-black dark:text-white",
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
