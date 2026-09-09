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

  const pista = useRef<HTMLDivElement>(null);
  const carro = useRef<HTMLDivElement>(null);
  const [arrastre, setArrastre] = useState(0);
  const [animando, setAnimando] = useState(false);

  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  // --- Deslizar para cambiar de foto ---------------------------------------
  //
  // Todo el gesto vive dentro de este efecto, con escuchas nativas y no con las
  // de React. La razón es concreta: React entrega `touchmove` en modo pasivo,
  // que es una promesa al navegador de que nadie va a frenar el gesto. Con esa
  // promesa hecha, Safari en iPhone se queda con el movimiento y lo interpreta
  // como desplazar o agrandar la página. Con la escucha nativa podemos pedir
  // `passive: false` y frenarlo cuando el arrastre es claramente horizontal.
  //
  // Se muestran tres fotos —la anterior, la actual y la siguiente— y se corre
  // el carro que las contiene. Al soltar, o completa el viaje o vuelve al
  // lugar; el cambio de foto se hace al terminar la animación, cuando la vecina
  // ya quedó en el medio, así el salto no se ve.
  useEffect(() => {
    const zona = pista.current;
    const carroEl = carro.current;
    if (!zona || !carroEl) return;

    const hayAnterior = index > 0;
    const haySiguiente = index < photos.length - 1;

    let gesto: { x: number; y: number; horizontal: boolean } | null = null;
    let corrido = 0;
    let destino: number | null = null;
    let reloj: number | null = null;

    const correr = (px: number) => {
      corrido = px;
      setArrastre(px);
    };

    const finalizar = () => {
      if (reloj !== null) {
        clearTimeout(reloj);
        reloj = null;
      }
      setAnimando(false);
      if (destino !== null) {
        const i = destino;
        destino = null;
        correr(0);
        onIndex(i);
      }
    };

    /// Arranca la animación y programa el cierre por las suyas. Esperar sólo al
    /// evento de fin de transición no alcanza: no llega si la pestaña queda en
    /// segundo plano. Sin esta red, el visor se trabaría sin responder.
    const animarHasta = (px: number) => {
      setAnimando(true);
      correr(px);
      if (reloj !== null) clearTimeout(reloj);
      reloj = window.setTimeout(finalizar, DURACION_MS + 120);
    };

    const alEmpezar = (e: TouchEvent) => {
      // Dos dedos es un pellizco, no un deslizamiento: no nos metemos.
      if (e.touches.length !== 1) {
        gesto = null;
        return;
      }
      const t = e.touches[0];
      gesto = { x: t.clientX, y: t.clientY, horizontal: false };
    };

    const alMover = (e: TouchEvent) => {
      if (!gesto || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - gesto.x;
      const dy = t.clientY - gesto.y;

      if (!gesto.horizontal) {
        // Todavía no sabemos para dónde va la mano.
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) <= Math.abs(dy)) {
          gesto = null;
          return;
        }
        gesto.horizontal = true;
      }

      // El gesto es nuestro: que el navegador no haga nada más con él.
      e.preventDefault();

      // Contra el borde no hay adónde ir: se deja arrastrar un poco y cuesta,
      // que es la forma de decir "hasta acá" sin un cartel.
      const contraElBorde = (dx > 0 && !hayAnterior) || (dx < 0 && !haySiguiente);
      correr(contraElBorde ? dx / 4 : dx);
    };

    const alSoltar = () => {
      const g = gesto;
      gesto = null;
      if (!g?.horizontal) return;

      const ancho = zona.clientWidth;
      const pasa = Math.abs(corrido) > umbral(ancho);
      const haciaSiguiente = corrido < 0 && haySiguiente;
      const haciaAnterior = corrido > 0 && hayAnterior;

      if (pasa && (haciaSiguiente || haciaAnterior)) {
        destino = index + (haciaSiguiente ? 1 : -1);
        animarHasta(haciaSiguiente ? -ancho : ancho);
        return;
      }

      if (corrido === 0) return; // no se movió: no hay nada que devolver
      animarHasta(0);
    };

    const alTerminarAnimacion = (e: TransitionEvent) => {
      if (e.propertyName !== "transform" || e.target !== carroEl) return;
      finalizar();
    };

    zona.addEventListener("touchstart", alEmpezar, { passive: true });
    zona.addEventListener("touchmove", alMover, { passive: false });
    zona.addEventListener("touchend", alSoltar);
    zona.addEventListener("touchcancel", alSoltar);
    carroEl.addEventListener("transitionend", alTerminarAnimacion);

    return () => {
      if (reloj !== null) clearTimeout(reloj);
      zona.removeEventListener("touchstart", alEmpezar);
      zona.removeEventListener("touchmove", alMover);
      zona.removeEventListener("touchend", alSoltar);
      zona.removeEventListener("touchcancel", alSoltar);
      carroEl.removeEventListener("transitionend", alTerminarAnimacion);
    };
  }, [index, photos.length, onIndex]);

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
      // Las dos formas de dar el alto, y en este orden. `inset-0` funciona en
      // cualquier navegador y es el piso. `h-dvh` lo mejora donde se entienda:
      // sigue a la barra del navegador cuando aparece y desaparece, que si no
      // tapa el pie del visor. Si un navegador no conoce esa unidad descarta
      // la regla y queda el piso; poner sólo `h-dvh` dejaba el visor sin alto
      // y la foto desaparecía.
      className="fixed inset-0 h-dvh z-50 bg-ground/95 backdrop-blur-sm flex flex-col"
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
        // Acá adentro el gesto lo manejamos nosotros: sin esto Safari se lleva
        // el movimiento y termina agrandando la página en vez de pasar de foto.
        style={{ touchAction: "none" }}
      >
        <div
          ref={carro}
          className="absolute inset-0"
          style={{
            transform: `translateX(${arrastre}px)`,
            transition: animando
              ? `transform ${DURACION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : "none",
          }}
        >
          {[-1, 0, 1].map((corrimiento) => {
            const i = index + corrimiento;
            const p = photos[i];
            return (
              <div
                key={p ? p.id : `vacia-${corrimiento}`}
                className="absolute inset-0 grid place-items-center px-3 sm:px-14"
                // Cada foto ocupa exactamente el ancho del visor, así que
                // correrla un 100% la deja justo al lado de la anterior.
                style={{ transform: `translateX(${corrimiento * 100}%)` }}
              >
                {p && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.previewUrl}
                    alt={corrimiento === 0 ? `Foto ${p.code}` : ""}
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
          onClick={() => index > 0 && onIndex(index - 1)}
          disabled={index === 0}
          aria-label="Foto anterior"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full border border-line bg-ground/70 backdrop-blur-sm disabled:opacity-25 con-mouse:hover:border-accent transition-colors"
        >
          &lsaquo;
        </button>
        <button
          onClick={() => index < photos.length - 1 && onIndex(index + 1)}
          disabled={index === photos.length - 1}
          aria-label="Foto siguiente"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full border border-line bg-ground/70 backdrop-blur-sm disabled:opacity-25 con-mouse:hover:border-accent transition-colors"
        >
          &rsaquo;
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
