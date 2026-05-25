import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Monochrome badge — only white, black, and grays. All variants are visually
// distinguishable via fill vs outline + weight, not color.
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-black/30 focus:ring-offset-2 dark:focus:ring-white/30",
  {
    variants: {
      variant: {
        // Solid black on white — primary
        default:
          "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black",
        // Inverted: white fill, black text + border
        secondary:
          "border-black/20 bg-white text-black dark:border-white/30 dark:bg-black dark:text-white",
        // Outline only — softest
        outline:
          "border-black/15 bg-transparent text-black dark:border-white/20 dark:text-white",
        // Destructive — kept high-contrast but neutral
        destructive:
          "border-black bg-white text-black underline decoration-2 underline-offset-2 dark:border-white dark:bg-black dark:text-white",
        // Semantic aliases — all map to the same neutral surfaces, distinguished
        // by callers via accompanying labels/icons (no color cues)
        success:
          "border-black/15 bg-neutral-100 text-black dark:border-white/20 dark:bg-neutral-900 dark:text-white",
        warning:
          "border-black/30 bg-neutral-50 text-black dark:border-white/30 dark:bg-neutral-900 dark:text-white",
        info: "border-black/15 bg-neutral-100 text-black dark:border-white/20 dark:bg-neutral-900 dark:text-white",
        muted:
          "border-black/10 bg-neutral-50 text-neutral-600 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-300",
        danger:
          "border-black bg-white text-black underline decoration-2 underline-offset-2 dark:border-white dark:bg-black dark:text-white",
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
