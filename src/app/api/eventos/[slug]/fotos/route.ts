import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { PHOTOS_PER_PAGE, photoSelect, toPhotoDTO } from "@/lib/photos";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const codigo = url.searchParams.get("codigo");
  const desde = Math.max(0, Number(url.searchParams.get("desde") ?? 0) || 0);

  const evento = await db.event.findFirst({
    where: { slug, published: true },
    select: { id: true },
  });
  if (!evento) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  const photos = await db.photo.findMany({
    where: {
      eventId: evento.id,
      ...(codigo ? { code: codigo.toUpperCase() } : {}),
    },
    orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
    ...(codigo ? {} : { skip: desde, take: PHOTOS_PER_PAGE }),
    select: photoSelect,
  });

  return NextResponse.json({ photos: photos.map(toPhotoDTO) });
}
