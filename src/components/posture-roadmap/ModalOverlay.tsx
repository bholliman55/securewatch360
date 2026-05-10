"use client";

import { useEffect, useCallback } from "react";

interface ModalOverlayProps {
  children: React.ReactNode;
  /** If provided, backdrop click and Escape key will call this. Omit to make it non-dismissible. */
  onClose?: () => void;
  /** max-width of the inner modal shell (default 520px) */
  maxWidth?: number;
}

/**
 * Shared glassmorphism overlay + centered modal shell used by all
 * posture-roadmap modals. Locks body scroll while mounted.
 */
export function ModalOverlay({ children, onClose, maxWidth = 520 }: ModalOverlayProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [handleKeyDown]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && onClose) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backdropFilter: "blur(8px)",
        background: "rgba(7,17,31,0.75)",
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full rounded-2xl flex flex-col animate-slide-in"
        style={{
          maxWidth,
          maxHeight: "90vh",
          background: "linear-gradient(175deg, #0d1e33 0%, #07111f 100%)",
          border: "1px solid rgba(0,229,255,0.25)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 40px rgba(0,229,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
