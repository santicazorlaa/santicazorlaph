import { notFound } from "next/navigation";

import { Muestra, type DatosMuestra } from "./muestra";
import { variantes } from "./variantes";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Muestrario de estilos",
  robots: { index: false, follow: false },
};

/// Herramienta interna para elegir la dirección visual del sitio. No se publica:
/// en producción esta ruta no existe.
export default async function EstiloPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const evento = await db.event.findFirst({
    where: { published: true, photos: { some: {} } },
    orderBy: { date: "desc" },
    include: {
      _count: { select: { photos: true } },
      photos: {
        take: 6,
        orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, code: true, thumbKey: true },
      },
    },
  });

  if (!evento) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-24">
        <h1 className="titulo text-3xl">Hace falta un partido con fotos</h1>
        <p className="mt-4 text-muted">
          El muestrario usa fotos reales para que la comparación sirva. Publicá un partido y
          volvé a entrar.
        </p>
      </div>
    );
  }

  const datos: DatosMuestra = {
    titulo: evento.title,
    fecha: evento.date,
    lugar: evento.location,
    cantidadFotos: evento._count.photos,
    precioArs: evento.priceArs,
    portada: publicUrl(evento.coverKey ?? evento.photos[0]!.thumbKey),
    fotos: evento.photos.map((f) => ({
      id: f.id,
      code: f.code,
      thumbUrl: publicUrl(f.thumbKey),
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="max-w-2xl">
        <p className="etiqueta text-accent">Uso interno · no se publica</p>
        <h1 className="titulo text-4xl sm:text-5xl mt-4 text-balance">
          Cómo puede verse el sitio
        </h1>
        <p className="mt-5 text-muted">
          El mismo pedazo de sitio —la portada, la tarjeta de un partido y la grilla de
          fotos— repetido en cuatro direcciones visuales, con las fotos de verdad. Elegí una
          y esa decisión se aplica sola a todas las pantallas.
        </p>
      </header>

      <div className="mt-12 space-y-12">
        {variantes.map((variante, i) => (
          <section key={variante.id}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="titulo text-2xl">
                <span className="text-accent tabular-nums">{i + 1}. </span>
                {variante.nombre}
              </h2>
              <span className="etiqueta text-muted">{variante.tipografias}</span>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-muted">{variante.idea}</p>

            <div
              className={`${variante.fuentes} mt-5 rounded-xl overflow-hidden border`}
              style={{
                ...variante.vars,
                background: "var(--color-ground)",
                color: "var(--color-ink)",
                borderColor: "var(--color-line)",
                fontFamily: "var(--font-sans)",
              }}
            >
              <Muestra datos={datos} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
