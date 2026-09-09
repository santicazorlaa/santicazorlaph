import { notFound } from "next/navigation";

import { Gallery } from "@/components/gallery";
import { db } from "@/lib/db";
import { textoDeEscalones } from "@/lib/descuentos";
import { fecha, plural, precio } from "@/lib/format";
import { PHOTOS_PER_PAGE, photoSelect, toPhotoDTO } from "@/lib/photos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const evento = await db.event.findFirst({
    where: { slug, published: true },
    select: { title: true },
  });
  return { title: evento?.title ?? "Partido" };
}

export default async function EventoPage({ params }: Props) {
  const { slug } = await params;

  const evento = await db.event.findFirst({
    where: { slug, published: true },
    include: { _count: { select: { photos: true } } },
  });
  if (!evento) notFound();

  const photos = await db.photo.findMany({
    where: { eventId: evento.id },
    orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
    take: PHOTOS_PER_PAGE,
    select: photoSelect,
  });

  return (
    <div className="mx-auto max-w-6xl px-5">
      <section className="py-10 sm:py-14 border-b border-line">
        <p className="etiqueta text-accent mb-4 tabular-nums">{fecha(evento.date)}</p>
        <h1 className="titulo text-4xl sm:text-6xl text-balance">{evento.title}</h1>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted tabular-nums">
          {evento.location && <span>{evento.location}</span>}
          <span>{plural(evento._count.photos, "foto", "fotos")}</span>
          <span>
            <span className="cifra">{precio(evento.priceArs)}</span> por foto
          </span>
        </div>

        {/* Un descuento que el comprador no ve no lo hace agregar una foto más. */}
        <p className="mt-4 text-sm text-muted">
          Llevando varias sale menos:{" "}
          <span className="text-accent">{textoDeEscalones()}</span>.
        </p>
      </section>

      <Gallery
        eventSlug={evento.slug}
        eventTitle={evento.title}
        priceArs={evento.priceArs}
        totalPhotos={evento._count.photos}
        initialPhotos={photos.map(toPhotoDTO)}
      />
    </div>
  );
}
