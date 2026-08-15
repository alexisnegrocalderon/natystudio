"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// El sitio es oscuro por diseño, así que el tema va fijo y no depende de
// next-themes ni de la preferencia del sistema.
const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--ink-raised)",
          "--normal-text": "var(--paper)",
          "--normal-border": "var(--line)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
