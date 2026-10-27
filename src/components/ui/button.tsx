import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Catalyst Brands navy actions with orange focus and warm hover surfaces.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-primary bg-primary text-primary-foreground hover:bg-brand-navy/90 active:bg-brand-navy/80 dark:border-primary dark:bg-primary dark:text-primary-foreground",
        destructive:
          "border border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:border-red-400 dark:bg-red-700 dark:text-white",
        outline:
          "border border-input bg-card text-foreground hover:border-brand-orange hover:bg-accent dark:border-slate-600 dark:bg-slate-900 dark:text-white",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-accent dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800",
        ghost:
          "border border-transparent text-foreground hover:bg-accent dark:text-white dark:hover:bg-neutral-900",
        link: "text-brand-link underline-offset-4 hover:underline dark:text-white",
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
