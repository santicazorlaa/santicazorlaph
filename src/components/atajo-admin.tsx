"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Atajo de teclado global: presionar Ctrl + Shift + A (o Cmd + Shift + A en Mac)
 * abre directamente el panel de administración sin tener que escribir la URL.
 * Muestra un aviso visual inmediato para confirmar que se detectó la pulsación.
 */
export function AtajoAdmin() {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setAbriendo(true);
        startTransition(() => {
          router.push("/admin");
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!abriendo) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-surface/95 border border-line text-ink text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur font-mono pointer-events-none"
    >
      <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
      <span>Abriendo panel admin…</span>
    </aside>
  );
}
