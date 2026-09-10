"use client";

import { useLinkStatus } from "next/link";

/**
 * La respuesta al clic en un link, mientras la pantalla nueva viene en camino.
 *
 * Next avisa cuándo un `<Link>` está esperando y estos dos componentes lo
 * dibujan. No aceleran nada: contestan. Un cambio de pantalla sin ninguna
 * marca se vive como el sitio colgado aunque tarde exactamente lo mismo, y esa
 * fue la queja.
 *
 * Los dos tienen que ir *adentro* de un `<Link>` —así funciona el hook— y los
 * dos arrancan invisibles, con 120ms de retraso puesto en el CSS: cuando la
 * pantalla ya estaba traída de antemano el cambio es instantáneo y la señal no
 * llega a verse. Aparece sólo cuando la espera es de verdad.
 */
export function SenalDeLink() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`senal-link ${pending ? "senal-link-activa" : ""}`} />;
}

/**
 * Lo mismo, pero tapando una tarjeta entera.
 *
 * En la grilla de partidos el clic cae sobre la foto, no sobre un renglón de
 * texto: la respuesta tiene que estar ahí y no en un rincón. El contenedor de
 * la tarjeta tiene que ser `relative`.
 */
export function VeloDeLink() {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden className={`velo-link ${pending ? "velo-link-activo" : ""}`}>
      <span className="senal-link senal-link-activa !m-0 w-2.5 h-2.5 text-accent" />
    </span>
  );
}

/**
 * La tercera forma: en vez de sumar un punto al costado, hace latir lo que ya
 * está.
 *
 * Es para los links donde no sobra lugar —el botón del carrito, que es un
 * ícono solo—. El punto de `SenalDeLink` reserva su espacio aunque no se vea,
 * y adentro de un botón redondo con el padding parejo eso corre el contenido
 * para un costado y se nota. Acá no se agrega nada: late lo que ya estaba.
 */
export function LatidoDeLink({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  // Siempre `inline-flex`, esté esperando o no: un ícono dentro de un `span`
  // normal se apoya en la línea de base del texto y arrastra un par de píxeles
  // de aire abajo, que descentran el botón justo como estaba antes.
  return (
    <span className={`inline-flex ${pending ? "late-esperando" : ""}`}>{children}</span>
  );
}
