"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/**
 * Hoja que sube desde abajo en el teléfono (y diálogo centrado en escritorio). Bloquea el scroll de fondo
 * mientras está abierta y se cierra con el fondo, la X o Escape.
 */
export function AdminSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="admin-sheet-root" data-open="true">
      <div className="admin-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="admin-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="admin-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="admin-sheet-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="admin-sheet-body">{children}</div>
      </div>
    </div>
  );
}
