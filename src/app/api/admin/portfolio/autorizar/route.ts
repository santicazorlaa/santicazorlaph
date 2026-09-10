import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdmin } from "@/lib/auth";
import { signedUploadUrl } from "@/lib/storage";

const MAX_BYTES = 60 * 1024 * 1024;

const schema = z.object({
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

/**
 * Primer paso de la carga de una foto del portfolio: devuelve un link para que
 * el navegador la suba directo al bucket.
 *
 * Es el mismo camino que las fotos de un partido y por el mismo motivo: el
 * archivo no puede pasar por el servidor, que rechaza cualquier petición de más
 * de 4,5 MB, y las fotos de la cámara de Santi pesan unos 19 MB.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { contentType, size } = parsed.data;

  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Sólo se aceptan imágenes" }, { status: 400 });
  }
  if (size > MAX_BYTES) {
    return NextResponse.json({ error: "La foto pesa más de 60 MB" }, { status: 400 });
  }

  const objeto = randomUUID();

  return NextResponse.json({
    objeto,
    uploadUrl: await signedUploadUrl(`portfolio-originales/${objeto}.jpg`, contentType),
  });
}
