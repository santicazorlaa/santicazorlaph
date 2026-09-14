"use client";

import { useState, useSyncExternalStore } from "react";
import type { DeliveryPhotoDTO } from "@/lib/deliveries";
import { Aparecer } from "./aparecer";
import { DeliveryLightbox } from "./delivery-lightbox";
import { descargarFotoBlob } from "@/lib/descargar-blob";

function columnasSegunAncho(ancho: number) {
  if (ancho >= 1024) return 4;
  if (ancho >= 640) return 3;
  return 2;
}

function useColumnas() {
  return useSyncExternalStore(
    (avisar) => {
      window.addEventListener("resize", avisar);
      return () => window.removeEventListener("resize", avisar);
    },
    () => columnasSegunAncho(window.innerWidth),
    () => 2,
  );
}

type Ubicada = { photo: DeliveryPhotoDTO; indice: number };

function repartir(photos: DeliveryPhotoDTO[], columnas: number): Ubicada[][] {
  const cols: Ubicada[][] = Array.from({ length: columnas }, () => []);
  const altos = new Array<number>(columnas).fill(0);

  photos.forEach((photo, indice) => {
    let masCorta = 0;
    for (let c = 1; c < columnas; c++) {
      if (altos[c] < altos[masCorta]) masCorta = c;
    }
    cols[masCorta].push({ photo, indice });
    altos[masCorta] += 1 / (photo.ratio || 1.5);
  });

  return cols;
}

type Props = {
  slug: string;
  totalPhotos: number;
  initialPhotos: DeliveryPhotoDTO[];
};

export function DeliveryGallery({ slug, totalPhotos, initialPhotos }: Props) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [loading, setLoading] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [sinResultado, setSinResultado] = useState(false);
  const [filtrando, setFiltrando] = useState(false);
  const [descargandoId, setDescargandoId] = useState<string | null>(null);

  const columnas = useColumnas();

  const cargarMas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/entrega/${slug}/fotos?desde=${photos.length}`);
      const data = (await res.json()) as { photos: DeliveryPhotoDTO[] };
      setPhotos((prev) => [...prev, ...data.photos]);
    } finally {
      setLoading(false);
    }
  };

  const buscarPorCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = codigo.trim().toUpperCase().replace(/^#/, "");
    if (!q) {
      setFiltrando(false);
      setSinResultado(false);
      setPhotos(initialPhotos);
      return;
    }
    setBuscando(true);
    setSinResultado(false);
    try {
      const res = await fetch(`/api/entrega/${slug}/fotos?codigo=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { photos: DeliveryPhotoDTO[] };
      setFiltrando(true);
      setPhotos(data.photos);
      setSinResultado(data.photos.length === 0);
    } finally {
      setBuscando(false);
    }
  };

  const limpiarBusqueda = () => {
    setCodigo("");
    setFiltrando(false);
    setSinResultado(false);
    setPhotos(initialPhotos);
  };

  const quedanPorCargar = !filtrando && photos.length < totalPhotos;
  const columnasFotos = repartir(photos, columnas);

  return (
    <section className="py-8">
      {/* Barra de filtro y búsqueda */}
      <div className="flex flex-wrap gap-4 items-center justify-between mb-8 pb-4 border-b border-line/60">
        <form onSubmit={buscarPorCodigo} className="flex items-center gap-2">
          <label className="sr-only" htmlFor="buscar-codigo">
            Buscar por código de foto
          </label>
          <input
            id="buscar-codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código (ej: 042)"
            maxLength={6}
            className="bg-surface border border-line rounded-md px-3 py-2 text-sm w-44 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-muted focus:border-accent outline-none font-mono"
          />
          <button
            type="submit"
            disabled={buscando}
            className="bg-surface border border-line hover:border-accent px-4 py-2 rounded-md text-xs font-medium transition-colors"
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>
          {filtrando && (
            <button
              type="button"
              onClick={limpiarBusqueda}
              className="text-xs text-muted hover:text-ink underline ml-1"
            >
              Ver todas
            </button>
          )}
        </form>

        <p className="text-xs text-muted tabular-nums">
          Mostrando {photos.length} de {totalPhotos} fotos
        </p>
      </div>

      {sinResultado && (
        <div className="text-center py-16 border border-line rounded-lg bg-surface/40 my-8">
          <p className="text-sm font-medium mb-1">No encontramos fotos con el código #{codigo}</p>
          <p className="text-xs text-muted mb-4">
            Revisá si el número está bien escrito o explorá todas las fotos de la galería.
          </p>
          <button
            type="button"
            onClick={limpiarBusqueda}
            className="bg-accent text-ground text-xs font-medium px-4 py-2 rounded hover:bg-accent/90"
          >
            Volver a ver todas
          </button>
        </div>
      )}

      {/* Grilla Masonry fluida */}
      <div
        className="grid gap-3 sm:gap-4 items-start"
        style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
      >
        {columnasFotos.map((columna, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-3 sm:gap-4">
            {columna.map(({ photo, indice }) => {
              return (
                <Aparecer key={photo.id} retraso={(indice % 12) * 20}>
                  <div className="group relative border border-line rounded-lg overflow-hidden bg-surface transition-all duration-200 hover:border-accent/80 hover:shadow-xl">
                    <div
                      className="relative overflow-hidden cursor-pointer bg-line/20"
                      style={{ aspectRatio: `${photo.width || 3} / ${photo.height || 2}` }}
                      onClick={() => setOpenIndex(indice)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.thumbUrl}
                        alt={`Foto #${photo.code}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const fallback = `https://drive.google.com/thumbnail?id=${photo.driveFileId}&sz=w600`;
                          if (target.src !== fallback) {
                            target.src = fallback;
                          }
                        }}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Código de la foto */}
                      <span className="absolute top-2.5 left-2.5 bg-ground/85 backdrop-blur font-mono text-[0.68rem] font-bold text-ink px-2 py-0.5 rounded border border-line/60 shadow-sm pointer-events-none">
                        #{photo.code}
                      </span>

                      {/* Overlay con botones rápidos en hover / móvil */}
                      <div className="absolute inset-0 bg-gradient-to-t from-ground/90 via-ground/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                        <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Botón de descarga en máxima resolución */}
                          <a
                            href={photo.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-center text-[0.72rem] bg-accent text-ground font-medium py-1.5 px-3 rounded shadow hover:bg-accent/90 transition-colors inline-flex items-center justify-center gap-1"
                            title="Descargar JPG original de Google Drive"
                          >
                            ⬇ Máxima Calidad
                          </a>

                          <div className="flex gap-1.5">
                            {/* Botón de descarga directa para Instagram/Redes sin abrir pestaña */}
                            <button
                              type="button"
                              disabled={descargandoId === photo.id}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setDescargandoId(photo.id);
                                try {
                                  await descargarFotoBlob(photo.previewUrl, `${photo.code}-redes.jpg`);
                                } finally {
                                  setDescargandoId(null);
                                }
                              }}
                              className="flex-1 text-center text-[0.68rem] bg-surface/95 border border-line text-ink py-1 px-2 rounded hover:border-accent transition-colors disabled:opacity-50"
                              title="Descargar versión optimizada para celular"
                            >
                              {descargandoId === photo.id ? "…" : "Redes"}
                            </button>

                            {/* Botón ver grande */}
                            <button
                              type="button"
                              onClick={() => setOpenIndex(indice)}
                              className="flex-1 text-center text-[0.68rem] bg-surface/95 border border-line text-ink py-1 px-2 rounded hover:border-accent transition-colors"
                            >
                              🔍 Ver grande
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Aparecer>
              );
            })}
          </div>
        ))}
      </div>

      {/* Botón Cargar Más */}
      {quedanPorCargar && (
        <div className="text-center mt-12 mb-8">
          <button
            type="button"
            onClick={cargarMas}
            disabled={loading}
            className="border border-line bg-surface hover:border-accent text-ink text-sm font-medium px-8 py-3 rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            {loading ? "Cargando fotos…" : "Cargar más fotos ↓"}
          </button>
        </div>
      )}

      {/* Visor Lightbox */}
      {openIndex !== null && (
        <DeliveryLightbox
          photos={photos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndex={(i) => setOpenIndex(i)}
        />
      )}
    </section>
  );
}
