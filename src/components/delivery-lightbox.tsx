"use client";

import { useState } from "react";

import type { DeliveryPhotoDTO } from "@/lib/deliveries";
import { fechaBreve, horaDe } from "@/lib/format";
import { avisarActividad } from "@/lib/actividad-entrega";
import { descargarFotoBlob } from "@/lib/descargar-blob";
import { respaldoDriveThumbUrl } from "@/lib/drive-respaldo";

import { CabeceraVisor, VisorDeslizante } from "./visor-deslizante";

type Props = {
  /// De qué entrega es, para poder anotar lo que se descarga desde acá.
  slug: string;
  photos: DeliveryPhotoDTO[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
};

/// Una foto de la entrega, con la miniatura abajo mientras baja la grande.
///
/// Las fotos de una entrega vienen de Google Drive y tardan bastante más que
/// las del sitio. Sin esto, el visor arranca con el marco vacío y la foto
/// aparece de golpe uno o dos segundos después. La miniatura ya se descargó
/// para la grilla, así que aparece en el acto y la grande se le sobrepone
/// cuando llega: nunca hay un cuadro en blanco.
///
/// Las dos van con `object-contain` en la misma caja y la foto es la misma, así
/// que quedan exactamente superpuestas y el relevo no se ve.
function FotoDeEntrega({ foto, actual }: { foto: DeliveryPhotoDTO; actual: boolean }) {
  const [lista, setLista] = useState(false);

  return (
    <div className="relative w-full h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.thumbUrl}
        alt=""
        aria-hidden
        draggable={false}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-contain select-none"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.previewUrl}
        alt={actual ? `Foto ${foto.code}` : ""}
        draggable={false}
        referrerPolicy="no-referrer"
        // Esperar solamente al `onLoad` no alcanza y el síntoma es de los
        // caros: si el navegador ya tiene la foto en memoria —cuando venís de
        // la vecina, o al volver a abrir la misma—, la imagen llega completa
        // antes de que React le enganche el aviso, el aviso nunca suena y la
        // grande se queda apagada para siempre. Lo que se veía entonces era la
        // miniatura estirada, o sea justo lo contrario de lo que esto busca. Al
        // engancharla se le pregunta si ya está, que es lo único que cubre los
        // dos casos. El `naturalWidth` es para no dar por buena una que falló:
        // una imagen rota también figura como completa.
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) setLista(true);
        }}
        onLoad={() => setLista(true)}
        onError={(e) => {
          const target = e.currentTarget;
          const respaldo = respaldoDriveThumbUrl(foto.driveFileId, "preview");
          if (target.src !== respaldo) target.src = respaldo;
        }}
        // La caja ocupa exactamente el hueco disponible y `object-contain` mete
        // la foto adentro sin recortarla ni deformarla, sea vertical u
        // horizontal.
        className={`absolute inset-0 w-full h-full object-contain select-none transition-opacity duration-200 ease-out ${
          lista ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

/// El visor de una entrega privada: la foto y los dos botones de descarga.
///
/// Cómo se pasa de una foto a otra —el deslizamiento, las flechas, el teclado,
/// el alto real de la pantalla en el celular— está en `visor-deslizante.tsx`,
/// el mismo que usa la galería de un partido. Antes esto tenía su propia copia
/// del gesto y se movía peor: sin frenar al navegador en el celular el
/// deslizamiento peleaba contra el scroll, y el cambio de foto se hacía en dos
/// pasadas, lo que dejaba un salto en el medio.
export function DeliveryLightbox({ slug, photos, index, onClose, onIndex }: Props) {
  const photo = photos[index];
  const [bajandoRedes, setBajandoRedes] = useState(false);

  if (!photo) return null;

  const fechaFoto = photo.takenAt ? new Date(photo.takenAt) : null;

  const datos = [
    ...(photo.camera ? [photo.camera] : []),
    ...(photo.lens ? [photo.lens] : []),
    ...(fechaFoto ? [`${fechaBreve(fechaFoto)} · ${horaDe(fechaFoto)}`] : []),
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
          extra={
            <span className="opacity-50 ml-2 hidden sm:inline normal-case tracking-normal">
              {photo.name}
            </span>
          }
          onCerrar={onClose}
        />
      }
      foto={(p, actual) => <FotoDeEntrega foto={p} actual={actual} />}
      pie={
        <div className="mx-auto max-w-5xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-muted tabular-nums leading-snug min-w-0">
            {datos.length > 0 ? datos.join(" · ") : "Sin datos de la cámara"}
          </p>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Descarga de la versión de 1600 px, sin abrir una pestaña. */}
            <button
              type="button"
              disabled={bajandoRedes}
              onClick={async () => {
                setBajandoRedes(true);
                avisarActividad(slug, "redes", photo.id);
                try {
                  await descargarFotoBlob(photo.previewUrl, `${photo.code}-redes.jpg`);
                } finally {
                  setBajandoRedes(false);
                }
              }}
              className="etiqueta rounded-full border border-line px-5 py-3 con-mouse:hover:border-accent transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-progress inline-flex items-center"
            >
              {bajandoRedes ? "Descargando" : "Para redes"}
              {bajandoRedes && (
                <span aria-hidden className="senal-link senal-link-activa" />
              )}
            </button>

            {/* El archivo original, tal cual salió de la cámara. */}
            <a
              href={photo.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => avisarActividad(slug, "original", photo.id)}
              className="etiqueta rounded-full bg-accent-solid text-accent-ink px-5 py-3 con-mouse:hover:opacity-90 transition-[opacity,transform] duration-150 ease-out active:scale-[0.97]"
            >
              Máxima calidad
            </a>
          </div>
        </div>
      }
    />
  );
}
