import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { generatePhotoCode } from "@/lib/orders";
import { deleteObject, getObject, putObject } from "@/lib/storage";
import { processPhoto } from "@/lib/watermark";

export const maxDuration = 60;

const schema = z.object({
  eventId: z.string().min(1),
  objeto: z.string().uuid(),
  filename: z.string().min(1).max(255),
});

/**
 * Segundo paso: el original ya está en el bucket. Acá se lo baja, se le pone la
 * marca de agua, se guardan las versiones reducidas y recién entonces la foto
 * aparece en la galería.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { eventId, objeto, filename } = parsed.data;

  const evento = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!evento) {
    return NextResponse.json({ error: "Partido inexistente" }, { status: 404 });
  }

  // La clave se arma acá y no viene del pedido: así nadie puede pedir que se
  // procese un archivo de otro evento.
  const originalKey = `originales/${eventId}/${objeto}.jpg`;

  let original: Buffer;
  try {
    original = await getObject("private", originalKey);
  } catch {
    return NextResponse.json(
      { error: `No encontramos la foto subida (${filename})` },
      { status: 404 },
    );
  }

  let procesada;
  try {
    procesada = await processPhoto(original);
  } catch {
    // Si no es una imagen válida, no dejamos el original tirado en el bucket.
    await deleteObject("private", originalKey).catch(() => {});
    return NextResponse.json(
      { error: `No pudimos leer ${filename}. ¿Es una imagen?` },
      { status: 400 },
    );
  }

  const previewKey = `preview/${eventId}/${objeto}.jpg`;
  const thumbKey = `thumb/${eventId}/${objeto}.jpg`;

  await Promise.all([
    putObject("public", previewKey, procesada.preview, "image/jpeg"),
    putObject("public", thumbKey, procesada.thumb, "image/jpeg"),
  ]);

  const photo = await db.photo.create({
    data: {
      eventId,
      code: await generatePhotoCode(),
      originalKey,
      previewKey,
      thumbKey,
      originalName: filename,
      width: procesada.width,
      height: procesada.height,
      sizeBytes: procesada.sizeBytes,
      camera: procesada.camera,
      lens: procesada.lens,
      takenAt: procesada.takenAt,
    },
    select: { id: true, code: true },
  });

  return NextResponse.json({ photo });
}
