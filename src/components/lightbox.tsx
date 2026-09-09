"use client";

import { useEffect } from "react";

import { horaDe, fechaBreve, precio } from "@/lib/format";
import type { PhotoDTO } from "@/lib/photos";

type Props = {
  photo: PhotoDTO;
  priceArs: number;
  inCart: boolean;
  position: string;
  onToggle: () => void;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

export function Lightbox({
  photo,
  priceArs,
  inCart,
  position,
  onToggle,
  onClose,
  onPrev,
  onNext,
}: Props) {
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  const tomada = photo.tomadaEn ? new Date(photo.tomadaEn) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${photo.code}`}
      className="fixed inset-0 z-50 bg-ground/95 backdrop-blur-sm flex flex-col"
    >
      <div className="flex items-center justify-between gap-4 px-5 h-14 border-b border-line shrink-0">
        <span className="etiqueta text-muted tabular-nums">
          #{photo.code} <span className="opacity-50 ml-2">{position}</span>
        </span>
        <button
          onClick={onClose}
          className="etiqueta text-muted hover:text-ink transition-colors"
          aria-label="Cerrar"
        >
          Cerrar
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center gap-2 px-2 sm:px-4">
        <button
          onClick={onPrev}
          disabled={!onPrev}
          aria-label="Foto anterior"
          className="shrink-0 w-10 h-10 grid place-items-center rounded-full border border-line disabled:opacity-25 hover:border-accent transition-colors"
        >
          ‹
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.previewUrl}
          alt={`Foto ${photo.code}`}
          className="flex-1 min-h-0 max-h-full w-auto object-contain mx-auto"
        />

        <button
          onClick={onNext}
          disabled={!onNext}
          aria-label="Foto siguiente"
          className="shrink-0 w-10 h-10 grid place-items-center rounded-full border border-line disabled:opacity-25 hover:border-accent transition-colors"
        >
          ›
        </button>
      </div>

      <div className="shrink-0 border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3 justify-between">
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted tabular-nums">
            {tomada && (
              <div className="flex gap-1.5">
                <dt className="sr-only">Tomada</dt>
                <dd>
                  {fechaBreve(tomada)} · {horaDe(tomada)}
                </dd>
              </div>
            )}
            <div className="flex gap-1.5">
              <dt className="sr-only">Resolución</dt>
              <dd>{photo.resolucion}</dd>
            </div>
            {photo.camara && (
              <div className="flex gap-1.5">
                <dt className="sr-only">Cámara</dt>
                <dd>{photo.camara}</dd>
              </div>
            )}
            {photo.lente && (
              <div className="flex gap-1.5">
                <dt className="sr-only">Lente</dt>
                <dd>{photo.lente}</dd>
              </div>
            )}
          </dl>

          <div className="flex items-center gap-4 ml-auto">
            <span className="cifra text-2xl">{precio(priceArs)}</span>
            <button
              onClick={onToggle}
              className={`etiqueta rounded-full px-6 py-3 transition-colors ${
                inCart
                  ? "border border-accent text-accent"
                  : "bg-accent-solid text-accent-ink hover:opacity-90"
              }`}
            >
              {inCart ? "Quitar del carrito" : "Agregar al carrito"}
            </button>
          </div>
        </div>
        <p className="text-center text-[0.7rem] text-muted pb-3">
          La descarga es en resolución completa y sin marca de agua.
        </p>
      </div>
    </div>
  );
}
