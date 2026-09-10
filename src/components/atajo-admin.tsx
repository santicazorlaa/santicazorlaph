"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atajo de teclado global: presionar Ctrl + Shift + A (o Cmd + Shift + A en Mac)
 * abre directamente el panel de administración sin tener que escribir la URL.
 */
export function AtajoAdmin() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        router.push("/admin");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
