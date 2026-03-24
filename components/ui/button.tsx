"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

export function Button({
  className,
  variant = "default",
  size = "md",
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "destructive" &&
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        variant === "outline" &&
          "border border-border bg-transparent text-foreground hover:bg-accent",
        variant === "secondary" &&
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "ghost" &&
          "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-11 px-6 text-base",
        size === "icon" && "h-9 w-9",
        className
      )}
      {...props}
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
