"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import FocusTrap from "focus-trap-react";

interface ModalOverlayProps {
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Accessible modal overlay with focus trap and Escape-to-close.
 * Wraps content in a focus-trap so Tab cannot escape the modal.
 */
export function ModalOverlay({ onClose, children, className }: ModalOverlayProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <FocusTrap
      focusTrapOptions={{
        allowOutsideClick: true,
        escapeDeactivates: false, // we handle Escape ourselves
      }}
    >
      <div
        className={className ?? "fixed inset-0 z-[70] flex items-center justify-center p-4"}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        {children}
      </div>
    </FocusTrap>
  );
}
