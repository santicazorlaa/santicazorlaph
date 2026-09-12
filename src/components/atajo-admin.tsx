"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Atajo de teclado global: presionar Ctrl + Shift + A (o Cmd + Shift + A en Mac)
 * abre directamente el panel de administración sin tener que escribir la URL.
 * Muestra un aviso visual inmediato para confirmar que se detectó la pulsación
 * y se apaga automáticamente al completarse la navegación o tras un tiempo límite.
 */
export function AtajoAdmin() {
  const router = useRouter();
  const pathname = usePathname();
  const [abriendo, setAbriendo] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [, startTransition] = useTransition();

  // Si la ruta cambió (ej. llegó a /admin o a /admin/login), cerramos el aviso.
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (abriendo) {
      setAbriendo(false);
    }
  }

  // Red de seguridad: si la navegación demora o se interrumpe, el aviso desaparece
  // solo tras 2,5 segundos para nunca quedarse fijo en pantalla.
  useEffect(() => {
    if (!abriendo) return;
    const timer = setTimeout(() => {
      setAbriendo(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [abriendo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbriendo(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        // Si ya está en la portada del panel o en el login, no hace falta reabrir
        if (pathname === "/admin" || pathname === "/admin/login") return;

        setAbriendo(true);
        startTransition(() => {
          router.push("/admin");
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);

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

