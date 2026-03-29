import { cn } from "@/lib/utils";
import { type SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, id, required, "aria-required": ariaRequired, ...props }, ref) => {
    const errorId = id && error ? `${id}-error` : undefined;
    return (
      <div className="w-full">
        <select
          ref={ref}
          id={id}
          className={cn(
            "flex h-11 md:h-10 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-base md:text-sm text-foreground",
            "focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/30",
            "transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
            error && "border-destructive",
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          aria-required={ariaRequired ?? required}
          required={required}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
