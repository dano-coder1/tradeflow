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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === "default" && "bg-primary/20 text-primary",
        variant === "secondary" && "bg-secondary text-secondary-foreground",
        variant === "success" && "bg-success/20 text-success",
        variant === "destructive" && "bg-destructive/20 text-destructive",
        variant === "warning" && "bg-warning/20 text-warning",
        variant === "outline" &&
          "border border-border bg-transparent text-foreground",
        className
      )}
      {...props}
    />
  );
}
