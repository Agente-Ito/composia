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
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary/60 disabled:opacity-40",
        variant === "primary" &&
          "bg-ds-primary text-white hover:bg-ds-secondary active:scale-[0.97] shadow-[0_0_18px_rgba(98,88,232,0.22)]",
        variant === "secondary" &&
          "border border-ds-line bg-transparent text-ds-muted hover:border-ds-line hover:text-ds-text active:scale-[0.97]",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
