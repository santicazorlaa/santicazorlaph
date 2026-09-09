"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCart, type CartItem } from "./cart-context";
import { Lightbox } from "./lightbox";
import type { PhotoDTO } from "@/lib/photos";
import { precio } from "@/lib/format";

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

      <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, i) => {
          const enCarrito = cart.has(photo.id);
          return (
            <li key={photo.id} className="relative group">
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                className="block w-full aspect-[3/2] bg-surface rounded-md overflow-hidden"
                aria-label={`Ver foto ${photo.code} en grande`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbUrl}
                  alt={`Foto ${photo.code}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>

              <button
                type="button"
                onClick={() => cart.toggle(toItem(photo))}
                aria-pressed={enCarrito}
                className={`absolute inset-x-2 bottom-2 etiqueta rounded px-2 py-1.5 transition-colors ${
                  enCarrito
                    ? "bg-accent text-accent-ink"
                    : "bg-ground/80 text-ink opacity-0 group-hover:opacity-100 focus-visible:opacity-100 backdrop-blur-sm"
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
            className="bg-accent text-accent-ink etiqueta rounded-full px-6 py-3 shadow-lg flex items-center gap-3"
          >
            <span>
              {cart.count} {cart.count === 1 ? "foto" : "fotos"}
            </span>
            <span className="opacity-60">·</span>
            <span className="tabular-nums">{precio(cart.total)}</span>
            <span className="opacity-60">·</span>
            <span>Ir al carrito</span>
          </Link>
        </div>
      )}

      {openIndex !== null && photos[openIndex] && (
        <Lightbox
          photo={photos[openIndex]}
          priceArs={priceArs}
          inCart={cart.has(photos[openIndex].id)}
          onToggle={() => cart.toggle(toItem(photos[openIndex]))}
          onClose={() => setOpenIndex(null)}
          onPrev={openIndex > 0 ? () => setOpenIndex(openIndex - 1) : undefined}
          onNext={
            openIndex < photos.length - 1 ? () => setOpenIndex(openIndex + 1) : undefined
          }
          position={`${openIndex + 1} / ${photos.length}`}
        />
      )}
    </section>
  );
}
