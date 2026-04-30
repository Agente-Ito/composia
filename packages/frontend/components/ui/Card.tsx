import { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className, title }: CardProps) {
  return (
    <div
      className={cn(
        "bg-ds-surface border border-ds-line rounded-xl p-5",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]",
        className
      )}
    >
      {title && (
        <p className="text-[10px] font-mono tracking-widest uppercase text-ds-muted mb-4">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
