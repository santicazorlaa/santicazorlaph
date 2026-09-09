"use client";

import { useEffect, useRef, useState } from "react";

import { horaDe, fechaBreve, precio } from "@/lib/format";
import type { PhotoDTO } from "@/lib/photos";

type Props = {
  photos: PhotoDTO[];
  index: number;
  priceArs: number;
  inCart: boolean;
  onToggle: () => void;
  onClose: () => void;
  onIndex: (i: number) => void;
};

/// Cuánto hay que arrastrar para que suelte a la foto siguiente. Un quinto del
/// ancho, pero nunca más de 120 px: en un celular angosto un umbral fijo se
/// siente pesado, y en una pantalla ancha uno proporcional se vuelve imposible.
const umbral = (ancho: number) => Math.min(120, ancho * 0.2);

/// Lo que tarda la foto en terminar de entrar cuando se suelta el dedo.
const DURACION_MS = 260;

export function Lightbox({
  photos,
  index,
  priceArs,
  inCart,
  onToggle,
  onClose,
  onIndex,
}: Props) {
  const photo = photos[index];

  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  // --- Deslizar para cambiar de foto ---------------------------------------
  //
  // Se muestran tres fotos en fila —la anterior, la actual y la siguiente— y se
  // corre la fila. Durante el arrastre la fila sigue al dedo; al soltar, o se
  // completa el viaje hacia la vecina o vuelve al lugar. Recién cuando termina
  // la animación se cambia el índice, y como la vecina queda entonces en el
  // medio, el salto no se ve.

  const pista = useRef<HTMLDivElement>(null);
  /// Cuánto está corrida la fila. La referencia es la fuente de verdad y el
  /// estado existe sólo para volver a dibujar: al soltar hay que leer el valor
  /// de este mismo instante, y el estado puede venir atrasado si el dedo se
  /// levanta en el mismo respiro en que se movió.
  const desplazamiento = useRef(0);
  const [arrastre, setArrastre] = useState(0);

  const correr = (px: number) => {
    desplazamiento.current = px;
    setArrastre(px);
  };

  const [animando, setAnimando] = useState(false);
  /// A qué foto hay que saltar cuando termine la animación.
  const destino = useRef<number | null>(null);
  /// Cierra el viaje aunque no llegue el evento de fin de transición.
  const relojDeSeguridad = useRef<number | null>(null);
  /// Dónde empezó el dedo, y si el gesto ya se decidió como horizontal.
  const gesto = useRef<{ x: number; y: number; horizontal: boolean } | null>(null);

  const hayAnterior = index > 0;
  const haySiguiente = index < photos.length - 1;

  const alBajar = (e: React.PointerEvent) => {
    if (animando) return;
    gesto.current = { x: e.clientX, y: e.clientY, horizontal: false };
  };

  const alMover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g) return;

    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;

    if (!g.horizontal) {
      // Todavía no sabemos si quiere pasar de foto o desplazar la página.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        gesto.current = null;
        return;
      }
      g.horizontal = true;
      try {
        // Seguir al dedo aunque se salga del elemento. Falla si el puntero ya
        // no está activo —el dedo se levantó entre dos eventos—, y en ese caso
        // no hay nada que capturar.
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // sin captura: el gesto igual funciona mientras no salga del visor
      }
    }

    // Contra el borde no hay adónde ir: se deja arrastrar un poco y cuesta, que
    // es la forma de decir "hasta acá" sin un cartel.
    const contraElBorde = (dx > 0 && !hayAnterior) || (dx < 0 && !haySiguiente);
    correr(contraElBorde ? dx / 4 : dx);
  };

  /// Cierra el viaje: deja de animar y, si había que cambiar de foto, cambia.
  /// La vecina pasa a estar en el medio, así que volver el desplazamiento a
  /// cero muestra exactamente lo mismo que ya se veía.
  const finalizar = () => {
    if (relojDeSeguridad.current !== null) {
      clearTimeout(relojDeSeguridad.current);
      relojDeSeguridad.current = null;
    }
    setAnimando(false);
    if (destino.current !== null) {
      onIndex(destino.current);
      destino.current = null;
      correr(0);
    }
  };

  /// Arranca la animación y programa el cierre por las suyas. Esperar sólo al
  /// evento de fin de transición no alcanza: no llega si la pestaña está en
  /// segundo plano, ni si el destino resulta ser el punto donde ya estaba. Sin
  /// esta red, el visor se quedaría trabado sin responder.
  const animarHasta = (px: number) => {
    setAnimando(true);
    correr(px);
    if (relojDeSeguridad.current !== null) clearTimeout(relojDeSeguridad.current);
    relojDeSeguridad.current = window.setTimeout(finalizar, DURACION_MS + 120);
  };

  const alSoltar = () => {
    const g = gesto.current;
    gesto.current = null;
    if (!g?.horizontal) return;

    const ancho = pista.current?.clientWidth ?? 0;
    const corrido = desplazamiento.current;
    const pasa = Math.abs(corrido) > umbral(ancho);
    const haciaSiguiente = corrido < 0 && haySiguiente;
    const haciaAnterior = corrido > 0 && hayAnterior;

    if (pasa && (haciaSiguiente || haciaAnterior)) {
      destino.current = index + (haciaSiguiente ? 1 : -1);
      animarHasta(haciaSiguiente ? -ancho : ancho);
      return;
    }

    if (corrido === 0) return; // no se movió: no hay nada que devolver
    animarHasta(0);
  };

  const alTerminarAnimacion = (e: React.TransitionEvent) => {
    if (e.propertyName !== "transform") return;
    finalizar();
  };

  // Si el visor se cierra a mitad de un viaje, no dejar el reloj corriendo.
  // Va acá abajo y no junto al efecto de arriba a propósito: React no permite
  // modificar después una referencia que un efecto anterior ya usó.
  useEffect(
    () => () => {
      if (relojDeSeguridad.current !== null) clearTimeout(relojDeSeguridad.current);
    },
    [],
  );

  const tomada = photo.tomadaEn ? new Date(photo.tomadaEn) : null;

  const datos: [string, string][] = [
    ...(tomada
      ? ([["Tomada", `${fechaBreve(tomada)} · ${horaDe(tomada)}`]] as [string, string][])
      : []),
    ["Original", photo.resolucion],
    ...(photo.camara ? ([["Cámara", photo.camara]] as [string, string][]) : []),
    ...(photo.lente ? ([["Lente", photo.lente]] as [string, string][]) : []),
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${photo.code}`}
      className="fixed inset-0 z-50 bg-ground/95 backdrop-blur-sm flex flex-col"
    >
      <div className="flex items-center justify-between gap-4 px-5 h-14 border-b border-line shrink-0">
        <span className="etiqueta text-muted tabular-nums">
          #{photo.code}
          <span className="opacity-50 ml-2">
            {index + 1} / {photos.length}
          </span>
        </span>
        <button
          onClick={onClose}
          className="etiqueta text-muted hover:text-ink transition-colors"
          aria-label="Cerrar"
        >
          Cerrar
        </button>
      </div>

      <div
        ref={pista}
        className="relative flex-1 min-h-0 overflow-hidden"
        // Vertical se lo deja al navegador; lo horizontal lo manejamos nosotros.
        style={{ touchAction: "pan-y" }}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      >
        <div
          className="flex h-full w-[300%]"
          style={{
            transform: `translateX(calc(-33.3333% + ${arrastre}px))`,
            transition: animando
              ? `transform ${DURACION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : "none",
          }}
          onTransitionEnd={alTerminarAnimacion}
        >
          {[index - 1, index, index + 1].map((i, ranura) => {
            const p = photos[i];
            return (
              <div
                key={p ? p.id : `vacia-${ranura}`}
                className="w-1/3 h-full shrink-0 grid place-items-center px-3 sm:px-14"
              >
                {p && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.previewUrl}
                    alt={i === index ? `Foto ${p.code}` : ""}
                    draggable={false}
                    // Las dos restricciones tienen que estar: con sólo el alto,
                    // una foto apaisada se sale por el costado en un celular.
                    className="max-h-full max-w-full w-auto h-auto object-contain select-none"
                  />
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => hayAnterior && onIndex(index - 1)}
          disabled={!hayAnterior}
          aria-label="Foto anterior"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full border border-line bg-ground/70 backdrop-blur-sm disabled:opacity-25 con-mouse:hover:border-accent transition-colors"
        >
          ‹
        </button>
        <button
          onClick={() => haySiguiente && onIndex(index + 1)}
          disabled={!haySiguiente}
          aria-label="Foto siguiente"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full border border-line bg-ground/70 backdrop-blur-sm disabled:opacity-25 con-mouse:hover:border-accent transition-colors"
        >
          ›
        </button>
      </div>

      <div
        className="shrink-0 border-t border-line"
        // El borde de abajo se lo queda la barra del sistema en un iPhone.
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-5xl px-5 py-4">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
            {datos.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="min-w-0">
                <dt className="etiqueta text-[0.6rem] text-muted">{etiqueta}</dt>
                <dd className="text-xs mt-1 tabular-nums leading-snug">{valor}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="cifra text-2xl leading-none">{precio(priceArs)}</p>
              <p className="text-[0.7rem] text-muted mt-1.5">
                Alta resolución, sin marca de agua
              </p>
            </div>
            <button
              onClick={onToggle}
              className={`etiqueta shrink-0 rounded-full px-5 sm:px-6 py-3 transition-colors ${
                inCart
                  ? "border border-accent text-accent"
                  : "bg-accent-solid text-accent-ink con-mouse:hover:opacity-90"
              }`}
            >
              {inCart ? "Quitar" : "Agregar al carrito"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
