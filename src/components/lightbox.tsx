"use client";

import { horaDe, fechaBreve, precio } from "@/lib/format";
import type { PhotoDTO } from "@/lib/photos";

import { CabeceraVisor, VisorDeslizante } from "./visor-deslizante";

type Props = {
  photos: PhotoDTO[];
  index: number;
  priceArs: number;
  inCart: boolean;
  onToggle: () => void;
  onClose: () => void;
  onIndex: (i: number) => void;
};

/// El visor de la galería de un partido: la foto con marca de agua, sus datos
/// y el botón para sumarla al carrito.
///
/// Cómo se pasa de una foto a otra —el deslizamiento, las flechas, el teclado,
/// el alto real de la pantalla en el celular— no está acá sino en
/// `visor-deslizante.tsx`, compartido con el visor de las entregas para que las
/// dos galerías se muevan igual.
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
    <VisorDeslizante
      fotos={photos}
      indice={index}
      claveDe={(p) => p.id}
      proporcionDe={(p) => p.ratio}
      etiqueta={`Foto ${photo.code}`}
      onIndice={onIndex}
      onCerrar={onClose}
      cabecera={
        <CabeceraVisor
          codigo={photo.code}
          posicion={index + 1}
          total={photos.length}
          onCerrar={onClose}
        />
      }
      foto={(p, actual) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={p.previewUrl}
          alt={actual ? `Foto ${p.code}` : ""}
          draggable={false}
          // La caja ocupa exactamente el hueco disponible y `object-contain`
          // mete la foto adentro sin recortarla ni deformarla, sea vertical u
          // horizontal.
          className="w-full h-full object-contain select-none"
        />
      )}
      pie={
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
              className={`etiqueta shrink-0 rounded-full px-5 sm:px-6 py-3 transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
                inCart
                  ? "border border-accent text-accent"
                  : "bg-accent-solid text-accent-ink con-mouse:hover:opacity-90"
              }`}
            >
              {inCart ? "Quitar" : "Agregar al carrito"}
            </button>
          </div>
        </div>
      }
    />
  );
}
