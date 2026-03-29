import { cn } from "@/lib/utils";
import { type TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, id, required, "aria-required": ariaRequired, ...props }, ref) => {
    const errorId = id && error ? `${id}-error` : undefined;
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          id={id}
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-base md:text-sm text-foreground",
            "placeholder:text-muted-foreground/70",
            "focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/30 focus:bg-white/[0.04]",
            "transition-all duration-200",
            "disabled:cursor-not-allowed disabled:opacity-40 resize-y",
            error && "border-destructive/50",
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          aria-required={ariaRequired ?? required}
          required={required}
          {...props}
        />
        {error && <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
