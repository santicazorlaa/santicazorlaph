"use client";

import { useState } from "react";

/**
 * El botón "Ya transferí" de una compra por transferencia.
 *
 * Al tocarlo pasan dos cosas: le avisamos al servidor (para que el panel de
 * ventas muestre que este comprador ya avisó) y abrimos WhatsApp con el
 * mensaje ya escrito, para que Santi vea el aviso y el comprador le pueda
 * mandar la foto del comprobante ahí mismo. El link de WhatsApp ya viene
 * armado desde el servidor (`linkWhatsapp` vive en `contenido.ts`, que tiene
 * `server-only` y no se puede importar acá).
 */
export function AvisoTransferencia({
  token,
  whatsappHref,
  yaAviso,
}: {
  token: string;
  whatsappHref: string | null;
  yaAviso: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [avisado, setAvisado] = useState(yaAviso);

  const avisar = async () => {
    setEnviando(true);
    try {
      await fetch(`/api/compra/${token}/aviso-transferencia`, { method: "POST" });
    } catch {
      // Si el aviso al servidor falla, igual lo mandamos a WhatsApp: ahí queda
      // el aviso real. El servidor lo va a registrar la próxima vez que
      // toque el botón.
    } finally {
      setAvisado(true);
      setEnviando(false);
    }
    if (whatsappHref) window.open(whatsappHref, "_blank", "noopener,noreferrer");
  };

  if (!whatsappHref) {
    return (
      <p className="text-sm text-muted border border-dashed border-line rounded-lg p-3.5 max-w-md">
        Escribile a Santi para avisarle que ya transferiste.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={avisar}
        disabled={enviando}
        aria-busy={enviando}
        className="etiqueta bg-accent-solid text-accent-ink rounded-md px-5 py-3 con-mouse:hover:opacity-90 active:scale-[0.98] transition-[opacity,transform] duration-150 ease-out disabled:opacity-50 disabled:cursor-progress inline-flex items-center gap-2"
      >
        {enviando ? "Abriendo WhatsApp" : "Ya transferí, avisarle a Santi"}
        {enviando && <span aria-hidden className="senal-link senal-link-activa" />}
      </button>
      {avisado && (
        <p className="text-xs text-accent">
          Listo: Santi va a confirmar tu pago apenas vea la transferencia. Podés volver a tocar
          el botón para abrir WhatsApp de nuevo.
        </p>
      )}
    </div>
  );
}
