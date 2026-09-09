"use client";

import { useState } from "react";

/**
 * Pide el link firmado en el momento del click. No lo generamos al renderizar
 * la página porque caduca a los pocos minutos.
 */
export function DownloadButton({ token, photoId }: { token: string; photoId: string }) {
  const [estado, setEstado] = useState<"listo" | "pidiendo" | "error">("listo");

  const descargar = async () => {
    setEstado("pidiendo");
    try {
      const res = await fetch(`/api/compra/${token}/descarga?foto=${photoId}`);
      const data = await res.json();
      if (!res.ok) {
        setEstado("error");
        return;
      }
      setEstado("listo");
      window.location.href = data.url;
    } catch {
      setEstado("error");
    }
  };

  return (
    <button
      onClick={descargar}
      disabled={estado === "pidiendo"}
      className="etiqueta text-[0.65rem] bg-accent-solid text-accent-ink rounded px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {estado === "pidiendo" ? "…" : estado === "error" ? "Reintentar" : "Descargar"}
    </button>
  );
}
