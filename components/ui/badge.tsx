import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "destructive"
  | "warning"
  | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide transition-colors",
        variant === "default" && "bg-[#0EA5E9]/15 text-[#0EA5E9]",
        variant === "secondary" && "bg-white/[0.06] text-muted-foreground",
        variant === "success" && "bg-emerald-500/15 text-emerald-400",
        variant === "destructive" && "bg-red-500/15 text-red-400",
        variant === "warning" && "bg-amber-500/15 text-amber-400",
        variant === "outline" &&
          "border border-white/[0.1] bg-transparent text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
