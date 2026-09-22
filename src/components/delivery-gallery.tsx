"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DeliveryPhotoDTO } from "@/lib/deliveries";
import { Aparecer } from "./aparecer";
import { DeliveryLightbox } from "./delivery-lightbox";
import { HuecoGrilla } from "./huecos";
import { descargarFotoBlob } from "@/lib/descargar-blob";
import { respaldoDriveThumbUrl } from "@/lib/drive-respaldo";

/// Cuántas columnas entran según el ancho. Los cortes coinciden con los de
/// Tailwind (sm y lg) para que la grilla acompañe al resto del sitio.
function columnasSegunAncho(ancho: number) {
  if (ancho >= 1024) return 4;
  if (ancho >= 640) return 3;
  return 2;
}

/// Cuántas columnas entran ahora mismo, atento a los cambios de tamaño.
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

/// Reparte las fotos en columnas mandando cada una a la columna más corta,
/// midiendo el alto en "anchos de columna" (una foto apaisada 3:2 mide 0,66).
///
/// Recorrer siempre desde el principio no es un descuido: como cada foto se
/// decide mirando sólo las anteriores, al traer más fotos las que ya estaban
/// caen exactamente en el mismo lugar.
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
  // Si el último pedido de fotos se cayó, y si el servidor ya dijo que no hay
  // más. Sin botón que apretar, son las dos cosas que evitan que la pantalla se
  // quede pidiendo al vacío o en silencio.
  const [fallo, setFallo] = useState(false);
  const [finDeLista, setFinDeLista] = useState(false);
  const centinela = useRef<HTMLDivElement>(null);
  /// Si hay un pedido en vuelo. Va en una referencia y no en el estado de
  /// `loading` porque el estado tarda un dibujo en actualizarse, y en ese hueco
  /// el final de la grilla y la apertura de una foto pueden pedir los dos la
  /// misma tanda: las fotos entrarían repetidas, con el id repetido, que es de
  /// lo peor que le puede pasar a una lista. Antes no era alcanzable porque
  /// había un solo botón; ahora hay dos cosas que piden solas.
  const pidiendo = useRef(false);

  const columnas = useColumnas();

  const quedanPorCargar = !filtrando && !finDeLista && photos.length < totalPhotos;

  const pedirMas = useCallback(async () => {
    if (pidiendo.current || !quedanPorCargar) return;
    pidiendo.current = true;
    setLoading(true);
    setFallo(false);
    try {
      const res = await fetch(`/api/entrega/${slug}/fotos?desde=${photos.length}`);
      if (!res.ok) throw new Error(`respondió ${res.status}`);
      const data = (await res.json()) as { photos: DeliveryPhotoDTO[] };
      // Una tanda vacía es el final de verdad, diga lo que diga la cuenta. Sin
      // esto, cualquier diferencia entre el total y lo que hay se vuelve un
      // pedido atrás del otro para siempre, porque nadie aprieta nada: las pide
      // la pantalla sola.
      if (data.photos.length === 0) setFinDeLista(true);
      else setPhotos((prev) => [...prev, ...data.photos]);
    } catch {
      setFallo(true);
    } finally {
      pidiendo.current = false;
      setLoading(false);
    }
  }, [quedanPorCargar, slug, photos.length]);

  /// Abre una foto en el visor y, si está cerca del final, pide la tanda que
  /// sigue. Se pide antes de llegar y no al llegar porque en la última foto el
  /// visor no deja seguir: el que desliza se chocaba contra una pared y tenía
  /// que cerrar, apretar "cargar más" y volver a entrar.
  const irA = useCallback(
    (i: number) => {
      setOpenIndex(i);
      if (i >= photos.length - 3) void pedirMas();
    },
    [photos.length, pedirMas],
  );

  // Las fotos siguen solas al llegar al final de la grilla. El aviso lo da un
  // hueco invisible puesto al pie: cuando se acerca a la pantalla, se piden las
  // que siguen. El margen es de casi una pantalla entera, así que llegan antes
  // de que se acaben las que hay y no se ve ningún corte.
  useEffect(() => {
    const el = centinela.current;
    if (!el) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) void pedirMas();
      },
      { rootMargin: "800px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [pedirMas]);

  const buscarPorCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = codigo.trim().toUpperCase().replace(/^#/, "");
    if (!q) {
      setFiltrando(false);
      setSinResultado(false);
      setFinDeLista(false);
      setFallo(false);
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
    setFinDeLista(false);
    setFallo(false);
    setPhotos(initialPhotos);
  };

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
            className="etiqueta border border-line rounded-md px-4 py-2 con-mouse:hover:border-accent transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-progress"
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>
          {filtrando && (
            <button
              type="button"
              onClick={limpiarBusqueda}
              className="etiqueta text-muted con-mouse:hover:text-ink px-2"
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
            className="etiqueta rounded-full bg-accent-solid text-accent-ink px-5 py-2.5 transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Volver a ver todas
          </button>
        </div>
      )}

      {/* La grilla, con la misma forma que la de un partido: columnas propias
          repartidas desde la primera foto, así "Cargar más" no mueve de lugar
          nada de lo que ya se está mirando. */}
      <div className="flex gap-3 items-start">
        {repartir(photos, columnas).map((columna, c) => (
          <ul key={c} className="flex-1 min-w-0 flex flex-col gap-3">
            {columna.map(({ photo, indice }) => (
              <li key={photo.id} className="relative group">
                <Aparecer retraso={Math.min(indice % 12, 5) * 45}>
                  {/* Toda la foto es el botón que la abre. Antes era un `div`
                      con un `onClick`: no se podía llegar con el teclado y, lo
                      que más se notaba, no se hundía al tocarlo, así que en el
                      celular tocar una foto no daba ninguna señal hasta que el
                      visor terminaba de abrirse. */}
                  <button
                    type="button"
                    onClick={() => irA(indice)}
                    className="block w-full bg-surface rounded-md overflow-hidden ring-1 ring-transparent con-mouse:group-hover:ring-accent/70 active:scale-[0.985] transition-[transform,box-shadow] duration-200"
                    aria-label={`Ver foto ${photo.code} en grande`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbUrl}
                      alt={`Foto ${photo.code}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const respaldo = respaldoDriveThumbUrl(photo.driveFileId);
                        if (target.src !== respaldo) target.src = respaldo;
                      }}
                      // El alto sale de la proporción real de la foto: así la
                      // grilla se acomoda a cada imagen y ninguna se recorta.
                      style={{ aspectRatio: String(photo.ratio || 1.5) }}
                      className="w-full h-auto object-cover con-mouse:group-hover:scale-[1.03] con-mouse:group-hover:brightness-110 transition-[transform,filter] duration-500 ease-out"
                    />
                  </button>

                  {/* Las descargas. En una computadora aparecen al pasar el
                      mouse; en un teléfono están siempre puestas, porque ahí no
                      existe pasar el mouse por encima y si no se veían no había
                      manera de bajar una foto desde la grilla. */}
                  <div className="absolute inset-x-2 bottom-2 flex gap-1.5 con-mouse:opacity-0 con-mouse:group-hover:opacity-100 con-mouse:focus-within:opacity-100 transition-opacity duration-150 ease-out">
                    <a
                      href={photo.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center etiqueta text-[0.6rem] rounded bg-accent-solid text-accent-ink px-2 py-1.5 transition-transform duration-150 ease-out active:scale-[0.96]"
                      title="Descargar el archivo original desde Google Drive"
                    >
                      Original
                    </a>
                    <button
                      type="button"
                      disabled={descargandoId === photo.id}
                      onClick={async () => {
                        setDescargandoId(photo.id);
                        try {
                          await descargarFotoBlob(
                            photo.previewUrl,
                            `${photo.code}-redes.jpg`,
                          );
                        } finally {
                          setDescargandoId(null);
                        }
                      }}
                      className="flex-1 etiqueta text-[0.6rem] rounded bg-ground/80 text-ink backdrop-blur-sm px-2 py-1.5 transition-transform duration-150 ease-out active:scale-[0.96] disabled:opacity-60 disabled:cursor-progress inline-flex items-center justify-center"
                      title="Descargar una versión liviana, lista para Instagram"
                    >
                      {descargandoId === photo.id ? "Bajando" : "Redes"}
                      {descargandoId === photo.id && (
                        <span aria-hidden className="senal-link senal-link-activa" />
                      )}
                    </button>
                  </div>

                  <span className="absolute top-2 left-2 etiqueta text-[0.6rem] bg-ground/70 backdrop-blur-sm rounded px-1.5 py-0.5 text-muted">
                    #{photo.code}
                  </span>
                </Aparecer>
              </li>
            ))}
          </ul>
        ))}
      </div>

      {/* Mientras vienen, se dibujan sus huecos abajo de las que ya están.
          Ahora que se piden solas son más importantes todavía: son lo único que
          dice que hay más en camino, y sin ellas el final de la grilla parece
          el final de las fotos. */}
      {loading && (
        <div className="mt-3">
          <HuecoGrilla cantidad={8} />
        </div>
      )}

      {/* Ya no hay botón de "Cargar más fotos": las que siguen se piden solas al
          llegar al final. Éste es el hueco invisible que lo avisa, y va abajo de
          los huecos grises para que quede siempre al pie de todo. */}
      {quedanPorCargar && !fallo && <div ref={centinela} aria-hidden className="h-px" />}

      {/* Si el pedido se cae, hay que decirlo y dar con qué reintentar: sin
          botón que apretar, la grilla se quedaría corta sin explicar por qué. */}
      {fallo && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted mb-3">
            No se pudieron traer más fotos. Puede ser la conexión.
          </p>
          <button
            type="button"
            onClick={() => void pedirMas()}
            disabled={loading}
            aria-busy={loading}
            className="etiqueta border border-line rounded-full px-8 py-3 con-mouse:hover:border-accent transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.98] disabled:opacity-50 disabled:cursor-progress inline-flex items-center"
          >
            {loading ? "Probando de nuevo" : "Reintentar"}
            {loading && <span aria-hidden className="senal-link senal-link-activa" />}
          </button>
        </div>
      )}

      {openIndex !== null && photos[openIndex] && (
        <DeliveryLightbox
          photos={photos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndex={irA}
        />
      )}
    </section>
  );
}
