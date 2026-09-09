"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useCart, type CartItem } from "./cart-context";
import { Lightbox } from "./lightbox";
import type { PhotoDTO } from "@/lib/photos";
import { precio } from "@/lib/format";

/// Cuántas columnas entran según el ancho. Los cortes coinciden con los de
/// Tailwind (sm y lg) para que la grilla acompañe al resto del sitio.
function columnasSegunAncho(ancho: number) {
  if (ancho >= 1024) return 4;
  if (ancho >= 640) return 3;
  return 2;
}

/// Cuántas columnas entran ahora mismo, atento a los cambios de tamaño.
///
/// Se suscribe al `resize` en vez de guardar el número en un estado: así no hay
/// un render de más en cada cambio, y en el servidor —donde no existe ventana—
/// devuelve 2, que es lo que corresponde a un celular.
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

type Ubicada = { photo: PhotoDTO; indice: number };

/// Reparte las fotos en columnas mandando cada una a la columna más corta,
/// midiendo el alto en "anchos de columna" (una foto apaisada 3:2 mide 0,66).
///
/// Recorrer siempre desde el principio no es un descuido: como cada foto se
/// decide mirando sólo las anteriores, al traer más fotos las que ya estaban
/// caen exactamente en el mismo lugar. Si en cambio dejáramos que el navegador
/// balancee las columnas solo, cada "Cargar más" te movería de lugar todas las
/// fotos de arriba, justo cuando estás mirándolas.
function repartir(photos: PhotoDTO[], columnas: number): Ubicada[][] {
  const cols: Ubicada[][] = Array.from({ length: columnas }, () => []);
  const altos = new Array<number>(columnas).fill(0);

  photos.forEach((photo, indice) => {
    let masCorta = 0;
    for (let c = 1; c < columnas; c++) {
      if (altos[c] < altos[masCorta]) masCorta = c;
    }
    cols[masCorta].push({ photo, indice });
    // ratio = ancho / alto, así que el alto relativo es su inversa.
    altos[masCorta] += 1 / (photo.ratio || 1.5);
  });

  return cols;
}

type Props = {
  eventSlug: string;
  eventTitle: string;
  priceArs: number;
  totalPhotos: number;
  initialPhotos: PhotoDTO[];
};

export function Gallery({
  eventSlug,
  eventTitle,
  priceArs,
  totalPhotos,
  initialPhotos,
}: Props) {
  const cart = useCart();
  const [photos, setPhotos] = useState(initialPhotos);
  const [loading, setLoading] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [codigo, setCodigo] = useState("");
  const columnas = useColumnas();
  const [buscando, setBuscando] = useState(false);
  const [sinResultado, setSinResultado] = useState(false);
  const filtrando = useRef(false);

  const toItem = useCallback(
    (photo: PhotoDTO): CartItem => ({
      photoId: photo.id,
      code: photo.code,
      eventSlug,
      eventTitle,
      thumbUrl: photo.thumbUrl,
      priceArs,
    }),
    [eventSlug, eventTitle, priceArs],
  );

  const cargarMas = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/eventos/${eventSlug}/fotos?desde=${photos.length}`,
      );
      const data = (await res.json()) as { photos: PhotoDTO[] };
      setPhotos((prev) => [...prev, ...data.photos]);
    } finally {
      setLoading(false);
    }
  };

  const buscarPorCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = codigo.trim().toUpperCase().replace(/^#/, "");
    if (!q) {
      filtrando.current = false;
      setSinResultado(false);
      setPhotos(initialPhotos);
      return;
    }
    setBuscando(true);
    setSinResultado(false);
    try {
      const res = await fetch(
        `/api/eventos/${eventSlug}/fotos?codigo=${encodeURIComponent(q)}`,
      );
      const data = (await res.json()) as { photos: PhotoDTO[] };
      filtrando.current = true;
      setPhotos(data.photos);
      setSinResultado(data.photos.length === 0);
    } finally {
      setBuscando(false);
    }
  };

  // Flechas para moverse entre fotos con el lightbox abierto.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : Math.min(i + 1, photos.length - 1)));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
      if (e.key === "Escape") setOpenIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, photos.length]);

  const quedanPorCargar = !filtrando.current && photos.length < totalPhotos;

  return (
    <section className="py-8">
      <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
        <form onSubmit={buscarPorCodigo} className="flex gap-2">
          <label className="sr-only" htmlFor="codigo">
            Buscar por código de foto
          </label>
          <input
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código de foto"
            maxLength={6}
            className="bg-surface border border-line rounded-md px-3 py-2 text-sm w-40 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-muted focus:border-accent outline-none"
          />
          <button
            type="submit"
            disabled={buscando}
            className="etiqueta border border-line rounded-md px-4 hover:border-accent transition-colors disabled:opacity-50"
          >
            {buscando ? "Buscando" : "Buscar"}
          </button>
          {filtrando.current && (
            <button
              type="button"
              onClick={() => {
                filtrando.current = false;
                setCodigo("");
                setSinResultado(false);
                setPhotos(initialPhotos);
              }}
              className="etiqueta text-muted hover:text-ink px-2"
            >
              Ver todas
            </button>
          )}
        </form>

        <p className="text-sm text-muted tabular-nums">
          Mostrando {photos.length} de {totalPhotos}
        </p>
      </div>

      {sinResultado && (
        <p className="text-muted border border-dashed border-line rounded-lg py-12 text-center">
          Ninguna foto de este partido tiene ese código.
        </p>
      )}

      <div className="flex gap-3 items-start">
        {repartir(photos, columnas).map((columna, c) => (
          <ul key={c} className="flex-1 min-w-0 flex flex-col gap-3">
            {columna.map(({ photo, indice }) => {
              const enCarrito = cart.has(photo.id);
              return (
                <li key={photo.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(indice)}
                    className="block w-full bg-surface rounded-md overflow-hidden ring-1 ring-transparent con-mouse:group-hover:ring-accent/70 active:scale-[0.985] transition-[transform,box-shadow] duration-200"
                    aria-label={`Ver foto ${photo.code} en grande`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbUrl}
                      alt={`Foto ${photo.code}`}
                      loading="lazy"
                      // El alto sale de la proporción real de la foto: así la
                      // grilla se acomoda a cada imagen y ninguna se recorta.
                      style={{ aspectRatio: String(photo.ratio || 1.5) }}
                      className="w-full h-auto object-cover con-mouse:group-hover:scale-[1.03] con-mouse:group-hover:brightness-110 transition-[transform,filter] duration-500 ease-out"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => cart.toggle(toItem(photo))}
                    aria-pressed={enCarrito}
                    className={`absolute inset-x-2 bottom-2 etiqueta rounded px-2 py-1.5 transition-opacity ${
                      enCarrito
                        ? "bg-accent-solid text-accent-ink"
                        : "bg-ground/80 text-ink backdrop-blur-sm con-mouse:opacity-0 con-mouse:group-hover:opacity-100 con-mouse:focus-visible:opacity-100"
                    }`}
                  >
                    {enCarrito ? "En el carrito" : "Agregar"}
                  </button>

                  <span className="absolute top-2 left-2 etiqueta text-[0.6rem] bg-ground/70 backdrop-blur-sm rounded px-1.5 py-0.5 text-muted">
                    #{photo.code}
                  </span>
                </li>
              );
            })}
          </ul>
        ))}
      </div>

      {quedanPorCargar && (
        <div className="mt-8 text-center">
          <button
            onClick={cargarMas}
            disabled={loading}
            className="etiqueta border border-line rounded-full px-8 py-3 hover:border-accent transition-colors disabled:opacity-50"
          >
            {loading ? "Cargando…" : "Cargar más fotos"}
          </button>
        </div>
      )}

      {cart.count > 0 && (
        <div className="sticky bottom-4 mt-10 flex justify-center">
          <Link
            href="/carrito"
            className="bg-accent-solid text-accent-ink etiqueta rounded-full px-6 py-3 shadow-lg flex items-center gap-3"
          >
            <span>
              {cart.count} {cart.count === 1 ? "foto" : "fotos"}
            </span>
            <span className="opacity-60">·</span>
            <span className="cifra">{precio(cart.total)}</span>
            <span className="opacity-60">·</span>
            <span>Ir al carrito</span>
          </Link>
        </div>
      )}

      {openIndex !== null && photos[openIndex] && (
        <Lightbox
          photos={photos}
          index={openIndex}
          priceArs={priceArs}
          inCart={cart.has(photos[openIndex].id)}
          onToggle={() => cart.toggle(toItem(photos[openIndex]))}
          onClose={() => setOpenIndex(null)}
          onIndex={setOpenIndex}
        />
      )}
    </section>
  );
}
