import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TextoEntrante } from "@/components/texto-entrante";

import { Gallery } from "@/components/gallery";
import { PreciosEscalonados } from "@/components/precios-escalonados";
import { db } from "@/lib/db";
import { leerEscalones } from "@/lib/ajustes";

import { fecha, plural, precio } from "@/lib/format";
import { PHOTOS_PER_PAGE, photoSelect, toPhotoDTO } from "@/lib/photos";
import { grafoBase, jsonLd, migaDePan } from "@/lib/seo";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/**
 * Cada partido arma su propia descripción con sus datos de verdad.
 *
 * Antes todos compartían la general del sitio y Google, al verla repetida,
 * la descartaba y mostraba lo primero que encontraba en la página: el pie. Con
 * la fecha, el lugar y el precio, el resultado ya le dice al jugador que es su
 * partido antes de entrar.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const evento = await db.event.findFirst({
    where: { slug, published: true },
    select: {
      title: true,
      date: true,
      location: true,
      category: true,
      priceArs: true,
      coverKey: true,
      _count: { select: { photos: true } },
      photos: { take: 1, orderBy: { takenAt: "asc" }, select: { thumbKey: true } },
    },
  });
  if (!evento) return { title: "Partido" };

  const donde = evento.location ? ` en ${evento.location}` : "";
  const deporte = evento.category ? ` de ${evento.category.toLowerCase()}` : "";
  const descripcion =
    `Fotos${deporte} de ${evento.title}, ${fecha(evento.date)}${donde}. ` +
    `${plural(evento._count.photos, "foto", "fotos")} a ${precio(evento.priceArs)} cada una: ` +
    `elegí las tuyas, pagá con MercadoPago y descargalas al instante sin marca de agua.`;
  const portada = evento.coverKey ?? evento.photos[0]?.thumbKey;
  const ruta = `/e/${slug}`;

  return {
    title: `Fotos de ${evento.title}`,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      ...grafoBase,
      url: ruta,
      title: `Fotos de ${evento.title}`,
      description: descripcion,
      ...(portada ? { images: [{ url: publicUrl(portada), alt: evento.title }] } : {}),
    },
  };
}

export default async function EventoPage({ params }: Props) {
  const { slug } = await params;

  const evento = await db.event.findFirst({
    where: { slug, published: true },
    include: { _count: { select: { photos: true } } },
  });
  if (!evento) notFound();

  const escalones = await leerEscalones();

  // Si Santi separó las fotos por equipo, la galería primero pregunta de cuál
  // es hincha en vez de mostrar las dos mezcladas — sin pestaña "Todas": la
  // foto que le sirve a los dos equipos la sube duplicada, así que cada una ya
  // vive en algún equipo. Con uno solo (o ninguno), no pregunta nada.
  const porEquipo = await db.photo.groupBy({
    by: ["equipo"],
    where: { eventId: evento.id, equipo: { not: null } },
    _count: true,
    orderBy: { equipo: "asc" },
  });
  const equipos = porEquipo.map((e) => ({
    nombre: e.equipo!,
    cantidad: e._count,
    portada: null as string | null,
    ratio: 1.5,
  }));

  // Una foto de muestra por equipo, para que elegir no sea leer dos nombres
  // sueltos en un cartel: se ve de qué partido es antes de tocar nada. Sólo se
  // pide con más de uno —con uno solo no hay nada que elegir— y es una
  // consulta liviana: `distinct` trae una fila por equipo, no todas.
  if (equipos.length > 1) {
    const portadas = await db.photo.findMany({
      where: { eventId: evento.id, equipo: { in: equipos.map((e) => e.nombre) } },
      distinct: ["equipo"],
      orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
      select: { equipo: true, thumbKey: true, width: true, height: true },
    });
    for (const p of portadas) {
      const eq = equipos.find((e) => e.nombre === p.equipo);
      if (eq) {
        eq.portada = publicUrl(p.thumbKey);
        eq.ratio = p.height > 0 ? p.width / p.height : 1.5;
      }
    }
  }

  // Con más de un equipo nadie va a ver esta primera tanda hasta elegir uno
  // —la galería abre con el selector, no con la grilla—, así que pedirla acá
  // sería una consulta a la base que nadie mira.
  const photos =
    equipos.length > 1
      ? []
      : await db.photo.findMany({
          where: { eventId: evento.id },
          orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
          take: PHOTOS_PER_PAGE,
          select: photoSelect,
        });

  return (
    <div className="mx-auto max-w-6xl px-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(migaDePan([{ nombre: evento.title, ruta: `/e/${evento.slug}` }]))}
      />
      <section className="py-10 sm:py-14 border-b border-line">
        <p className="etiqueta text-accent mb-4 tabular-nums">{fecha(evento.date)}</p>
        <TextoEntrante as="h1" className="titulo text-4xl sm:text-6xl text-balance">
          {evento.title}
        </TextoEntrante>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted tabular-nums">
          {evento.location && <span>{evento.location}</span>}
          <span>{plural(evento._count.photos, "foto", "fotos")}</span>
          <span>
            <span className="cifra">{precio(evento.priceArs)}</span> por foto
          </span>
          {evento.packPriceArs && (
            <span className="text-accent">
              o llevate las {evento._count.photos} por{" "}
              <span className="cifra">{precio(evento.packPriceArs)}</span>
            </span>
          )}
        </div>

      </section>

      {/* Antes de la grilla: si se entera del precio por cantidad recién en el
          carrito, ya eligió una sola foto y la decisión está tomada. */}
      <div className="mt-8">
        <PreciosEscalonados priceArs={evento.priceArs} escalones={escalones} />
      </div>

      <Gallery
        eventSlug={evento.slug}
        eventTitle={evento.title}
        priceArs={evento.priceArs}
        totalPhotos={evento._count.photos}
        packPriceArs={evento.packPriceArs}
        initialPhotos={photos.map(toPhotoDTO)}
        equipos={equipos}
      />
    </div>
  );
}
