"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DeliveryPhotoDTO } from "@/lib/deliveries";
import { fechaBreve, horaDe } from "@/lib/format";
import { descargarFotoBlob } from "@/lib/descargar-blob";

type Props = {
  photos: DeliveryPhotoDTO[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
};

const umbral = (ancho: number) => Math.min(120, ancho * 0.2);
const DURACION_MS = 260;

function useAltoVisible() {
  return useSyncExternalStore(
    (avisar) => {
      const vista = window.visualViewport;
      vista?.addEventListener("resize", avisar);
      window.addEventListener("resize", avisar);
      window.addEventListener("orientationchange", avisar);
      return () => {
        vista?.removeEventListener("resize", avisar);
        window.removeEventListener("resize", avisar);
        window.removeEventListener("orientationchange", avisar);
      };
    },
    () => Math.round(window.visualViewport?.height ?? window.innerHeight),
    () => 0,
  );
}

export function DeliveryLightbox({ photos, index, onClose, onIndex }: Props) {
  const photo = photos[index];
  const pista = useRef<HTMLDivElement>(null);
  const carro = useRef<HTMLDivElement>(null);
  const altoVisible = useAltoVisible();
  const [bajandoRedes, setBajandoRedes] = useState(false);

  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex(Math.min(photos.length - 1, index + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onIndex]);

  // Gestos táctiles
  useEffect(() => {
    const zona = pista.current;
    const carroEl = carro.current;
    if (!zona || !carroEl) return;

    const hayAnterior = index > 0;
    const haySiguiente = index < photos.length - 1;

    let inicioX = 0;
    let inicioY = 0;
    let deltaX = 0;
    let bloqueado = false;
    let evaluando = true;

    const onStart = (e: TouchEvent) => {
      inicioX = e.touches[0].clientX;
      inicioY = e.touches[0].clientY;
      deltaX = 0;
      evaluando = true;
      bloqueado = false;
      carroEl.style.transition = "none";
    };

    const onMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - inicioX;
      const dy = e.touches[0].clientY - inicioY;

      if (evaluando) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          evaluando = false;
          bloqueado = Math.abs(dx) > Math.abs(dy);
        }
      }

      if (!bloqueado) return;
      e.preventDefault();

      const frenado =
        (!hayAnterior && dx > 0) || (!haySiguiente && dx < 0) ? dx * 0.25 : dx;
      deltaX = frenado;
      carroEl.style.transform = `translateX(${frenado}px)`;
    };

    const onEnd = () => {
      if (!bloqueado) return;

      const ancho = zona.clientWidth;
      const limite = umbral(ancho);
      const vaSiguiente = deltaX < -limite && haySiguiente;
      const vaAnterior = deltaX > limite && hayAnterior;

      carroEl.style.transition = `transform ${DURACION_MS}ms cubic-bezier(0.2, 0.9, 0.3, 1)`;

      if (vaSiguiente) {
        carroEl.style.transform = `translateX(-${ancho}px)`;
        setTimeout(() => {
          onIndex(index + 1);
          carroEl.style.transition = "none";
          carroEl.style.transform = "translateX(0)";
        }, DURACION_MS);
      } else if (vaAnterior) {
        carroEl.style.transform = `translateX(${ancho}px)`;
        setTimeout(() => {
          onIndex(index - 1);
          carroEl.style.transition = "none";
          carroEl.style.transform = "translateX(0)";
        }, DURACION_MS);
      } else {
        carroEl.style.transform = "translateX(0)";
      }
    };

    zona.addEventListener("touchstart", onStart, { passive: true });
    zona.addEventListener("touchmove", onMove, { passive: false });
    zona.addEventListener("touchend", onEnd);
    zona.addEventListener("touchcancel", onEnd);

    return () => {
      zona.removeEventListener("touchstart", onStart);
      zona.removeEventListener("touchmove", onMove);
      zona.removeEventListener("touchend", onEnd);
      zona.removeEventListener("touchcancel", onEnd);
    };
  }, [index, photos.length, onIndex]);

  const anterior = index > 0 ? photos[index - 1] : null;
  const siguiente = index < photos.length - 1 ? photos[index + 1] : null;

  const fechaFoto = photo?.takenAt ? new Date(photo.takenAt) : null;

  return (
    <div
      ref={pista}
      role="dialog"
      aria-modal="true"
      aria-label="Visor de foto"
      style={{ height: altoVisible ? `${altoVisible}px` : "100vh" }}
      className="fixed inset-0 z-50 bg-ground/98 flex flex-col justify-between select-none overflow-hidden"
    >
      {/* Barra superior */}
      <header className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 z-10 border-b border-line/40 bg-ground/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-accent">#{photo.code}</span>
          <span className="text-xs text-muted font-mono hidden sm:inline">{photo.name}</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-muted tabular-nums">
            {index + 1} de {photos.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar visor"
            className="text-xs border border-line rounded-full px-3 py-1.5 text-muted hover:text-ink hover:border-accent transition-colors"
          >
            ✕ Cerrar
          </button>
        </div>
      </header>

      {/* Carro de imágenes para deslizamiento suave */}
      <div className="relative flex-1 min-h-0 overflow-hidden flex items-center justify-center">
        {/* Flechas de escritorio */}
        {index > 0 && (
          <button
            type="button"
            onClick={() => onIndex(index - 1)}
            aria-label="Foto anterior"
            className="hidden sm:flex absolute left-4 z-20 w-11 h-11 items-center justify-center rounded-full bg-surface/80 border border-line text-ink hover:border-accent hover:scale-105 transition-all"
          >
            ←
          </button>
        )}

        {index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => onIndex(index + 1)}
            aria-label="Foto siguiente"
            className="hidden sm:flex absolute right-4 z-20 w-11 h-11 items-center justify-center rounded-full bg-surface/80 border border-line text-ink hover:border-accent hover:scale-105 transition-all"
          >
            →
          </button>
        )}

        <div
          ref={carro}
          className="absolute inset-0 flex items-center justify-center will-change-transform"
        >
          {/* Foto anterior */}
          {anterior && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none p-4"
              style={{ transform: "translateX(-100%)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={anterior.previewUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallback = `https://drive.google.com/thumbnail?id=${anterior.driveFileId}&sz=w1600`;
                  if (target.src !== fallback) target.src = fallback;
                }}
                className="max-h-full max-w-full object-contain rounded"
              />
            </div>
          )}

          {/* Foto actual */}
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.previewUrl}
              alt={photo.name}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = `https://drive.google.com/thumbnail?id=${photo.driveFileId}&sz=w1600`;
                if (target.src !== fallback) target.src = fallback;
              }}
              className="max-h-full max-w-full object-contain rounded shadow-2xl transition-opacity duration-150"
            />
          </div>

          {/* Foto siguiente */}
          {siguiente && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none p-4"
              style={{ transform: "translateX(100%)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={siguiente.previewUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallback = `https://drive.google.com/thumbnail?id=${siguiente.driveFileId}&sz=w1600`;
                  if (target.src !== fallback) target.src = fallback;
                }}
                className="max-h-full max-w-full object-contain rounded"
              />
            </div>
          )}
        </div>
      </div>

      {/* Barra inferior con metadatos y botones de descarga */}
      <footer className="shrink-0 border-t border-line/40 bg-ground/90 backdrop-blur px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 z-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted tabular-nums text-center sm:text-left">
          {photo.camera && <span>📷 {photo.camera}</span>}
          {photo.lens && <span>🔍 {photo.lens}</span>}
          {fechaFoto && (
            <span>
              🕒 {fechaBreve(fechaFoto)} {horaDe(fechaFoto)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Descarga para redes (1600px preview sin abrir pestaña) */}
          <button
            type="button"
            disabled={bajandoRedes}
            onClick={async () => {
              setBajandoRedes(true);
              try {
                await descargarFotoBlob(photo.previewUrl, `${photo.code}-redes.jpg`);
              } finally {
                setBajandoRedes(false);
              }
            }}
            className="flex-1 sm:flex-initial text-center text-xs border border-line bg-surface hover:border-accent text-ink px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {bajandoRedes ? "Descargando…" : "Descargar para Redes"}
          </button>

          {/* Descarga directa en máxima calidad (archivo original desde Google Drive) */}
          <a
            href={photo.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-initial text-center text-xs bg-accent text-ground font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors shadow"
          >
            ⬇ Máxima Calidad
          </a>
        </div>
      </footer>
    </div>
  );
}
