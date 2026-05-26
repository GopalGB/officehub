import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Pure-white theme — primary buttons are bordered white, not filled black.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-black bg-white text-black hover:bg-neutral-50 active:bg-neutral-100 dark:border-white dark:bg-black dark:text-white dark:hover:bg-neutral-900",
        destructive:
          "border-2 border-black bg-white text-black underline decoration-2 underline-offset-2 hover:bg-neutral-50 dark:border-white dark:bg-black dark:text-white",
        outline:
          "border border-black/15 bg-transparent text-black hover:bg-neutral-50 dark:border-white/20 dark:text-white dark:hover:bg-neutral-900",
        secondary:
          "border border-transparent bg-neutral-100 text-black hover:bg-neutral-200 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800",
        ghost:
          "border border-transparent text-black hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-900",
        link: "text-black underline-offset-4 hover:underline dark:text-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
