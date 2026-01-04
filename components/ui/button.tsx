"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600/80 text-white shadow-lg backdrop-blur-md border border-white/20 hover:bg-blue-600 transition-all active:scale-95",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-blue-200/50 bg-white/30 backdrop-blur-sm shadow-sm hover:bg-blue-50/50 hover:text-blue-600 dark:border-blue-500/30 dark:bg-blue-950/30",
        secondary:
          "bg-blue-50/80 text-blue-600 shadow-sm backdrop-blur-sm hover:bg-blue-100/80 dark:bg-blue-900/40 dark:text-blue-300",
        ghost: "text-blue-600/70 hover:bg-blue-50 hover:text-blue-600 dark:text-blue-400/70 dark:hover:bg-blue-900/50 dark:hover:text-blue-300",
        link: "text-blue-600 underline-offset-4 hover:underline",
        glass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 backdrop-blur-md hover:bg-blue-500/20 transition-all active:scale-95",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
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

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
