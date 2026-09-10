"use client";

import { useEffect, useRef } from "react";

import { suavizar } from "@/lib/fisheye";

/// Cuánto dura cada vuelo. Abrir es un poco más lento que cerrar a propósito:
/// al abrir uno está esperando ver la foto y el recorrido es lo que explica de
/// dónde salió; al cerrar ya la vio y lo único que quiere es volver.
export const ABRIR_MS = 460;
export const CERRAR_MS = 380;

/// Lo que la capa se queda encima de la tarjeta, apagándose, después de
/// aterrizar. No es un adorno: al desaparecer de golpe quedaba un parpadeo. El
/// visor se desmonta en el instante en que la foto llega —y con él se va su
/// fondo desenfocado, que es lo caro de sacar—, así que este ratito es el que
/// tapa ese cambio. Como la capa está exactamente encima de la tarjeta y las
/// dos muestran la misma foto, apagarse ahí no se ve.
const APAGARSE_MS = 110;

export type CajaDeVuelo = { x: number; y: number; ancho: number; alto: number };

export function cajaDe(el: Element): CajaDeVuelo {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, ancho: r.width, alto: r.height };
}

/**
 * La foto viajando entre la cinta y el visor.
 *
 * Es la técnica que se llama FLIP: en vez de aparecer en el centro de la nada,
 * la foto sale del lugar exacto donde estaba y crece hasta su tamaño grande. El
 * recorrido es lo que dice *cuál* de todas las fotos se abrió, que en una cinta
 * en movimiento no es obvio: sin él, la foto aparece en el centro y al cerrarse
 * uno no sabe adónde volvió.
 *
 * **Al cerrar, el destino se vuelve a leer en cada cuadro.** Es la parte que
 * importa y la que no se puede hacer con una transición de CSS, que necesita
 * saber el punto final desde el principio: la cinta se puso a andar de nuevo
 * apenas empezó el cierre, así que la tarjeta a la que hay que volver se está
 * moviendo. Leyéndola cuadro a cuadro, la foto se acopla a donde la tarjeta
 * *está* y no a donde estaba cuando arrancó el cierre, y aterriza sin ese
 * salto de último momento.
 *
 * Las dos cajas tienen la misma proporción —la de la foto de verdad, porque en
 * el portfolio nada se recorta ni en la cinta ni en el visor—, así que el vuelo
 * es una interpolación pura de posición y tamaño. Si una recortara y la otra
 * no, habría que interpolar además el encuadre.
 */
export function VueloDeFoto({
  url,
  desde,
  hacia,
  duracionMs,
  alAterrizar,
  alPrimerCuadro,
  alTerminar,
}: {
  url: string;
  /// De dónde sale. Se mide una sola vez, al empezar.
  desde: CajaDeVuelo;
  /// Adónde va. Se consulta en cada cuadro, no una sola vez al empezar: es lo
  /// que permite aterrizar sobre una tarjeta que se sigue moviendo. Si devuelve
  /// nulo se sigue con el último destino bueno.
  hacia: () => CajaDeVuelo | null;
  duracionMs: number;
  /// Se avisa cuando la foto llegó a destino, antes de que la capa se apague.
  /// Es el momento de sacar el visor: la capa todavía está tapando el lugar.
  alAterrizar?: () => void;
  /// Se avisa apenas la capa dibujó su primer cuadro. Lo usa el visor para
  /// saber cuándo puede esconder su propia foto: si la esconde antes, queda un
  /// cuadro en el que no hay ninguna foto en pantalla y se ve el fondo pelado.
  /// Dura dieciséis milésimas de segundo y se lee como un parpadeo negro.
  alPrimerCuadro?: () => void;
  alTerminar: () => void;
}) {
  const foto = useRef<HTMLImageElement>(null);
  // El aviso de terminado se guarda en un `ref` para que el bucle no se rearme
  // cada vez que el componente de arriba vuelve a dibujarse con otra función.
  // Se actualiza en un efecto y no durante el dibujo: escribir un `ref`
  // mientras React está dibujando es de las cosas que no garantiza.
  const avisar = useRef(alTerminar);
  useEffect(() => {
    avisar.current = alTerminar;
  }, [alTerminar]);

  const avisarPintado = useRef(alPrimerCuadro);
  useEffect(() => {
    avisarPintado.current = alPrimerCuadro;
  }, [alPrimerCuadro]);

  const avisarLlegada = useRef(alAterrizar);
  useEffect(() => {
    avisarLlegada.current = alAterrizar;
  }, [alAterrizar]);

  useEffect(() => {
    const el = foto.current;
    if (!el) return;

    const arranque = performance.now();
    let cuadro = 0;
    let ultimoDestino: CajaDeVuelo | null = null;
    let yaPinto = false;
    let apagando: ReturnType<typeof setTimeout> | null = null;

    /// La foto llegó. Se avisa para que el visor se saque de encima, y la capa
    /// se queda un momento más apagándose sobre la tarjeta.
    const aterrizar = () => {
      avisarLlegada.current?.();
      el.style.transition = `opacity ${APAGARSE_MS}ms linear`;
      el.style.opacity = "0";
      apagando = setTimeout(() => avisar.current(), APAGARSE_MS);
    };

    /// Se llama al final de cada cuadro, y sólo hace algo la primera vez.
    const marcarPintado = () => {
      if (yaPinto) return;
      yaPinto = true;
      avisarPintado.current?.();
    };

    const pintar = (ahora: number) => {
      const avance = Math.min(1, (ahora - arranque) / duracionMs);
      const t = suavizar(avance);

      // El destino móvil puede desaparecer —la tarjeta se fue de pantalla, o la
      // ventana cambió de tamaño—; en ese caso se sigue con el último bueno en
      // vez de cortar el vuelo a la mitad.
      const destino = hacia() ?? ultimoDestino;

      // Y puede no haber habido destino nunca: la foto que se abrió ya no está
      // a la vista. Ahí no hay vuelo que valga —irse hacia un punto fuera de la
      // pantalla se lee como que la foto se escapa—, así que se apaga en el
      // lugar, encogiéndose apenas para que se entienda que se fue y no que se
      // cortó. Lo que se le suma a la posición es lo que compensa que la
      // esquina de arriba a la izquierda esté clavada: sin eso se encogería
      // hacia ese rincón en vez de hacia su propio centro.
      if (!destino) {
        const s = 1 - 0.08 * t;
        el.style.opacity = String(1 - t);
        el.style.transform =
          `translate3d(${desde.x + (desde.ancho * (1 - s)) / 2}px, ` +
          `${desde.y + (desde.alto * (1 - s)) / 2}px, 0) scale(${s})`;
        marcarPintado();
        if (avance >= 1) {
          // El que se apaga en el lugar ya viene con su propia opacidad
          // bajando, así que acá sólo hay que cerrar.
          avisarLlegada.current?.();
          avisar.current();
          return;
        }
        cuadro = requestAnimationFrame(pintar);
        return;
      }
      ultimoDestino = destino;

      const x = desde.x + (destino.x - desde.x) * t;
      const y = desde.y + (destino.y - desde.y) * t;
      const ancho = desde.ancho + (destino.ancho - desde.ancho) * t;
      const alto = desde.alto + (destino.alto - desde.alto) * t;

      // Posición y tamaño en un solo `transform`: escalar es gratis para el
      // navegador, cambiar el ancho y el alto lo obliga a rehacer el dibujo en
      // cada cuadro. Por eso la capa mide siempre lo mismo —el tamaño de
      // partida— y lo que cambia es cuánto se la estira.
      el.style.transform =
        `translate3d(${x}px, ${y}px, 0) scale(${ancho / desde.ancho}, ${alto / desde.alto})`;

      marcarPintado();

      if (avance >= 1) {
        aterrizar();
        return;
      }
      cuadro = requestAnimationFrame(pintar);
    };

    cuadro = requestAnimationFrame(pintar);
    return () => {
      if (cuadro) cancelAnimationFrame(cuadro);
      if (apagando) clearTimeout(apagando);
    };
  }, [desde, hacia, duracionMs]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={foto}
      src={url}
      alt=""
      aria-hidden
      decoding="async"
      className="fixed top-0 left-0 z-[60] pointer-events-none object-cover rounded"
      style={{
        width: desde.ancho,
        height: desde.alto,
        // Todo el crecimiento se mide desde la esquina de arriba a la
        // izquierda, que es la esquina cuya posición estamos interpolando.
        transformOrigin: "top left",
        transform: `translate3d(${desde.x}px, ${desde.y}px, 0)`,
      }}
    />
  );
}
