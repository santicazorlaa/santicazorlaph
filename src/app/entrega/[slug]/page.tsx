import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TextoEntrante } from "@/components/texto-entrante";
import { PinGate } from "@/components/pin-gate";
import { BotonDriveEntrega } from "@/components/boton-drive-entrega";
import { DeliveryGallery } from "@/components/delivery-gallery";
import { entregaAutorizada } from "@/lib/auth";
import { db } from "@/lib/db";
import { fecha, plural } from "@/lib/format";
import { toDeliveryPhotoDTO } from "@/lib/deliveries";
import { grafoBase } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

/// La portada la elige Santi con el botón "Usar como portada" en el panel de
/// la entrega. Sale igual sin PIN: es sólo la vista previa del link al
/// compartirlo (WhatsApp, etc.), no la galería.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entrega = await db.clientDelivery.findUnique({
    where: { slug, published: true },
    select: { title: true, clientName: true, coverUrl: true },
  });

  if (!entrega) {
    return {
      title: "Entrega de Fotos",
      robots: { index: false, follow: false },
      referrer: "no-referrer",
    };
  }

  const titulo = `${entrega.title} · ${entrega.clientName}`;

  return {
    title: titulo,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
    openGraph: {
      ...grafoBase,
      title: titulo,
      ...(entrega.coverUrl ? { images: [{ url: entrega.coverUrl }] } : {}),
    },
  };
}

export default async function EntregaPage({ params }: Props) {
  const { slug } = await params;

  const entrega = await db.clientDelivery.findUnique({
    where: { slug, published: true },
    include: {
      _count: { select: { photos: true } },
    },
  });

  if (!entrega) notFound();

  // Verificación de PIN si la entrega tiene uno configurado
  if (!(await entregaAutorizada(entrega))) {
    return (
      <div className="mx-auto max-w-4xl px-5">
        <PinGate
          slug={entrega.slug}
          title={entrega.title}
          clientName={entrega.clientName}
        />
      </div>
    );
  }

  // Traer las primeras 48 fotos para la grilla inicial
  const photos = await db.deliveryPhoto.findMany({
    where: { deliveryId: entrega.id },
    orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
    take: 48,
  });

  return (
    <div className="mx-auto max-w-6xl px-5">
      {/* Encabezado de la entrega */}
      <section className="py-10 sm:py-14 border-b border-line">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="etiqueta text-accent">{entrega.clientName}</span>
          <span className="text-xs text-muted">·</span>
          <p className="etiqueta text-muted tabular-nums">{fecha(entrega.date)}</p>
        </div>

        <TextoEntrante as="h1" className="titulo text-3xl sm:text-5xl text-balance">
          {entrega.title}
        </TextoEntrante>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm text-muted">
          <div className="flex flex-wrap gap-x-6 gap-y-2 tabular-nums">
            {entrega.location && <span>{entrega.location}</span>}
            <span>{plural(entrega._count.photos, "foto", "fotos")}</span>
            <span className="text-ink font-medium">Descargas libres en máxima calidad</span>
          </div>

          <BotonDriveEntrega slug={entrega.slug} url={entrega.driveUrl} />
        </div>
      </section>

      {/* Grilla de fotos con visor y descarga individual */}
      {entrega._count.photos === 0 ? (
        <div className="text-center py-20 text-muted text-sm border border-line rounded-lg bg-surface/30 my-10">
          <p className="text-base font-medium mb-1">Las fotos se están preparando</p>
          <p className="text-xs max-w-md mx-auto">
            Santi Cazorla está subiendo y procesando los archivos para tu equipo. Podés volver a
            actualizar esta página en unos minutos.
          </p>
        </div>
      ) : (
        <DeliveryGallery
          slug={entrega.slug}
          totalPhotos={entrega._count.photos}
          initialPhotos={photos.map(toDeliveryPhotoDTO)}
        />
      )}
    </div>
  );
}
