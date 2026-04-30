import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "active" | "neutral" | "inactive";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

const dot: Record<Variant, string> = {
  active:   "bg-ds-primary shadow-[0_0_6px_theme(colors.ds.primary)]",
  neutral:  "bg-ds-text/40",
  inactive: "bg-ds-text/20",
};

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-ds-text/70",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dot[variant])} />
      {children}
    </span>
  );
}
