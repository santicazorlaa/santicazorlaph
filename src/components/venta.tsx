"use client";

import { useState } from "react";

import { BotonEnvio } from "./boton-envio";

export type FotoComprada = {
  id: string;
  code: string;
  thumbUrl: string;
  partido: string;
  precio: string;
};

/**
 * Una venta en el panel, que se abre para ver todos sus detalles.
 *
 * Muestra el nombre completo del comprador, su correo, Instagram, total, fecha,
 * ID de Mercado Pago, el enlace de descarga directa para compartirle y la
 * lista de fotos adquiridas.
 */
export function Venta({
  token,
  email,
  buyerName,
  instagram,
  fecha,
  fechaPago,
  mpPaymentId,
  cantidad,
  total,
  pagada,
  fotos,
  formId,
}: {
  id?: string;
  token?: string;
  email: string;
  buyerName?: string | null;
  instagram: string | null;
  fecha: string;
  fechaPago?: string | null;
  mpPaymentId?: string | null;
  cantidad: string;
  total: string;
  pagada: boolean;
  fotos: FotoComprada[];
  formId: string | null;
}) {
  const [abierta, setAbierta] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const copiarLink = () => {
    if (!token) return;
    const url = `${window.location.origin}/compra/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          className="etiqueta text-[0.65rem] text-muted con-mouse:hover:text-fg transition-colors w-4 shrink-0"
          aria-label={abierta ? "Ocultar detalles de la venta" : "Ver detalles de la venta"}
        >
          <span
            className={`inline-block transition-transform duration-200 ease-out ${
              abierta ? "rotate-90" : ""
            }`}
          >
            ›
          </span>
        </button>

        <div className="flex-1 min-w-44">
          <p
            className={`text-sm leading-tight px-1.5 truncate ${
              buyerName ? "font-medium text-ink" : "text-muted/60 italic"
            }`}
          >
            {buyerName || (pagada ? "Sin nombre de Mercado Pago" : "Esperando pago")}
          </p>
          {formId ? (
            <input
              type="email"
              name="email"
              form={formId}
              defaultValue={email}
              className="w-full bg-transparent border border-transparent hover:border-line focus:border-accent rounded px-1.5 py-0.5 -mx-1.5 outline-none transition-colors text-xs text-muted"
            />
          ) : (
            <span className="block truncate px-1.5 text-xs text-muted">{email}</span>
          )}
        </div>

        <span className="text-sm text-muted tabular-nums">{fecha}</span>
        <span className="text-sm text-muted tabular-nums w-20 text-right">{cantidad}</span>
        <span className="text-sm tabular-nums w-24 text-right font-medium">{total}</span>
        <span
          className={`etiqueta text-[0.65rem] w-20 text-right ${
            pagada ? "text-good" : "text-muted"
          }`}
        >
          {pagada ? "Pagada" : "Pendiente"}
        </span>
        <span className="w-28 text-right">
          {formId && (
            <BotonEnvio
              enviando="Enviando…"
              className="text-[0.65rem] text-muted con-mouse:hover:text-accent"
            >
              Reenviar mail
            </BotonEnvio>
          )}
        </span>
      </div>

      {instagram && (
        <a
          href={`https://instagram.com/${instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent con-mouse:hover:underline ml-9 inline-block mt-1 font-mono"
        >
          @{instagram}
        </a>
      )}

      {/* Panel desplegable con la ficha completa de la venta */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out ${
          abierta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="ml-9 my-3 bg-surface border border-line rounded-lg p-4 space-y-4 text-xs">
            {/* Cabecera de la ficha con todos los datos que vienen por mail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-3 border-b border-line">
              <div>
                <span className="text-muted block text-[0.65rem] uppercase tracking-wider mb-1">
                  Comprador
                </span>
                <p className="text-sm font-medium text-ink">
                  {buyerName || "No informado por MercadoPago / Pendiente"}
                </p>
                <p className="text-muted text-xs mt-0.5">{email}</p>
                {instagram ? (
                  <a
                    href={`https://instagram.com/${instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline inline-flex items-center gap-1 mt-1 font-mono text-xs"
                  >
                    @{instagram} ↗
                  </a>
                ) : (
                  <span className="text-muted/50 text-[0.7rem] block mt-1">No dejó Instagram</span>
                )}
              </div>

              <div>
                <span className="text-muted block text-[0.65rem] uppercase tracking-wider mb-1">
                  Cobro & Mercado Pago
                </span>
                <p className="font-medium text-ink text-sm">
                  {total} <span className="text-xs text-muted font-normal">({cantidad})</span>
                </p>
                <p className="text-muted text-xs mt-0.5">
                  {pagada ? `Acreditado: ${fechaPago || fecha}` : `Iniciado: ${fecha}`}
                </p>
                {mpPaymentId ? (
                  <p className="text-muted font-mono text-[0.7rem] mt-1">
                    ID Pago MP: <span className="text-ink font-semibold">#{mpPaymentId}</span>
                  </p>
                ) : (
                  <p className="text-muted/50 text-[0.7rem] mt-1">
                    {pagada ? "Pago registrado" : "Sin ID de pago (pendiente)"}
                  </p>
                )}
              </div>

              <div>
                <span className="text-muted block text-[0.65rem] uppercase tracking-wider mb-1">
                  Enlace de descarga del cliente
                </span>
                <p className="text-[0.7rem] text-muted mb-1.5">
                  Para pasárselo directo por WhatsApp si te lo pide:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {token ? (
                    <>
                      <a
                        href={`/compra/${token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="etiqueta text-xs text-accent hover:underline inline-flex items-center gap-1"
                      >
                        Abrir entrega ↗
                      </a>
                      <button
                        type="button"
                        onClick={copiarLink}
                        className="etiqueta text-xs border border-line rounded px-2.5 py-1 text-muted hover:text-ink hover:border-accent transition-colors"
                      >
                        {copiado ? "✓ ¡Copiado!" : "Copiar link"}
                      </button>
                    </>
                  ) : (
                    <span className="text-muted/50 text-xs">Sin enlace generado</span>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de fotos */}
            <div>
              <span className="text-muted block text-[0.65rem] uppercase tracking-wider mb-2">
                Fotos adquiridas ({fotos.length})
              </span>
              <ul className="flex flex-wrap gap-3">
                {fotos.map((foto) => (
                  <li key={foto.id} className="w-28">
                    <div className="aspect-[3/2] bg-ground rounded overflow-hidden border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={foto.thumbUrl}
                        alt={`Foto ${foto.code}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="etiqueta text-[0.65rem] font-medium text-ink mt-1 truncate">
                      #{foto.code} · {foto.precio}
                    </p>
                    <p className="text-[0.65rem] text-muted truncate">{foto.partido}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
