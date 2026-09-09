import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { signedUploadUrl } from "@/lib/storage";

const MAX_BYTES = 60 * 1024 * 1024;

const schema = z.object({
  eventId: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

/**
 * Primer paso de la carga: devuelve un link para que el navegador suba el
 * original directo al bucket. El archivo no pasa por el servidor, que es la
 * única forma de subir fotos de 20 MB — las funciones de Vercel rechazan
 * cualquier petición de más de 4,5 MB.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { eventId, contentType, size } = parsed.data;

  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Sólo se aceptan imágenes" }, { status: 400 });
  }
  if (size > MAX_BYTES) {
    return NextResponse.json({ error: "La foto pesa más de 60 MB" }, { status: 400 });
  }

  const evento = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!evento) {
    return NextResponse.json({ error: "Partido inexistente" }, { status: 404 });
  }

  // El nombre del archivo en el bucket no tiene relación con el código que ve
  // el comprador: si la carga se abandona a mitad, no quema ningún código.
  const objeto = randomUUID();
  const originalKey = `originales/${eventId}/${objeto}.jpg`;

  return NextResponse.json({
    objeto,
    originalKey,
    uploadUrl: await signedUploadUrl(originalKey, contentType),
  });
}
