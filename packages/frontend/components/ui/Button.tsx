import { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({ variant = "primary", children, className, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary/60 disabled:opacity-40",
        variant === "primary" &&
          "bg-ds-primary text-white shadow-[0_0_20px_rgba(123,97,255,0.35)] hover:bg-ds-secondary hover:shadow-[0_0_28px_rgba(123,97,255,0.50)] hover:scale-[1.02] active:scale-[0.97]",
        variant === "secondary" &&
          "border border-white/20 bg-ds-surface/60 text-white/70 hover:border-ds-secondary/60 hover:text-white/85 hover:bg-ds-surface hover:shadow-[0_0_16px_rgba(123,97,255,0.18)] active:scale-[0.97]",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
