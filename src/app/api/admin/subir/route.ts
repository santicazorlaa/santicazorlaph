import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { generatePhotoCode } from "@/lib/orders";
import { putObject } from "@/lib/storage";
import { processPhoto } from "@/lib/watermark";

// Procesar una foto de 20MP lleva un rato; no queremos que el runtime la corte.
export const maxDuration = 60;

const MAX_BYTES = 40 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await request.formData();
  const eventId = String(form.get("eventId") ?? "");
  const file = form.get("file");

  if (!eventId || !(file instanceof File)) {
    return NextResponse.json({ error: "Falta el partido o el archivo" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `${file.name} pesa más de 40 MB` },
      { status: 400 },
    );
  }

  const evento = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!evento) {
    return NextResponse.json({ error: "Partido inexistente" }, { status: 404 });
  }

  const original = Buffer.from(await file.arrayBuffer());

  let procesada;
  try {
    procesada = await processPhoto(original);
  } catch {
    return NextResponse.json(
      { error: `No pudimos leer ${file.name}. ¿Es una imagen?` },
      { status: 400 },
    );
  }

  const code = await generatePhotoCode();
  const base = `${eventId}/${code}`;
  const originalKey = `originales/${base}.jpg`;
  const previewKey = `preview/${base}.jpg`;
  const thumbKey = `thumb/${base}.jpg`;

  // El original va al bucket privado; los dos con marca de agua, al público.
  await Promise.all([
    putObject("private", originalKey, original, file.type || "image/jpeg"),
    putObject("public", previewKey, procesada.preview, "image/jpeg"),
    putObject("public", thumbKey, procesada.thumb, "image/jpeg"),
  ]);

  const photo = await db.photo.create({
    data: {
      eventId,
      code,
      originalKey,
      previewKey,
      thumbKey,
      originalName: file.name,
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
