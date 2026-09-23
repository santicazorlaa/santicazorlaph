"use client";

import { useState } from "react";

export function CopiarLinkEntrega({
  url,
  titulo,
  equipo,
  pin,
}: {
  url: string;
  titulo: string;
  equipo: string;
  pin: string | null;
}) {
  const [copiadoLink, setCopiadoLink] = useState(false);
  const [copiadoWpp, setCopiadoWpp] = useState(false);

  const mensajeWhatsApp = `¡Hola ${equipo}! Ya están listas las fotos de ${titulo}.\n\nPueden ver la galería y descargar cada foto en máxima calidad acá:\n${url}${
    pin ? `\n\nPIN de acceso: *${pin}*` : ""
  }\n\n¡Abrazo grande! Santi Cazorla`;

  const copiarLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopiadoLink(true);
    setTimeout(() => setCopiadoLink(false), 2500);
  };

  const copiarWhatsApp = async () => {
    await navigator.clipboard.writeText(mensajeWhatsApp);
    setCopiadoWpp(true);
    setTimeout(() => setCopiadoWpp(false), 2500);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={copiarLink}
        className="text-xs bg-surface border border-line rounded px-3 py-2 font-medium hover:border-accent hover:text-ink transition-colors inline-flex items-center gap-1.5"
      >
        <span>{copiadoLink ? "✓ Link copiado" : "Copiar link"}</span>
      </button>

      <button
        type="button"
        onClick={copiarWhatsApp}
        className="text-xs bg-accent text-ground font-medium rounded px-3.5 py-2 hover:bg-accent/90 transition-colors inline-flex items-center gap-1.5 shadow-sm"
      >
        <span>{copiadoWpp ? "✓ Mensaje copiado" : "Copiar texto para WhatsApp"}</span>
      </button>
    </div>
  );
}
