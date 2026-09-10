import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { deleteObject, getObject, putObject } from "@/lib/storage";
import { procesarPortfolio } from "@/lib/watermark";

export const maxDuration = 60;

const schema = z.object({
  objeto: z.string().uuid(),
  filename: z.string().min(1).max(255),
});

/**
 * Segundo paso: el original ya está en el bucket privado. Acá se lo baja y se
 * guardan las dos versiones limpias —la grande que se abre y la de la grilla—,
 * ninguna con marca de agua.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { objeto, filename } = parsed.data;

  // La clave se arma acá y no viene del pedido: así nadie puede pedir que se
  // procese un archivo cualquiera del bucket.
  const originalKey = `portfolio-originales/${objeto}.jpg`;

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
    procesada = await procesarPortfolio(original);
  } catch {
    // Si no es una imagen válida, no dejamos el original tirado en el bucket.
    await deleteObject("private", originalKey).catch(() => {});
    return NextResponse.json(
      { error: `No pudimos leer ${filename}. ¿Es una imagen?` },
      { status: 400 },
    );
  }

  const key = `portfolio/${objeto}.jpg`;
  const thumbKey = `portfolio/${objeto}-chica.jpg`;

  await Promise.all([
    putObject("public", key, procesada.grande, "image/jpeg"),
    putObject("public", thumbKey, procesada.thumb, "image/jpeg"),
  ]);

  // Al final de la fila: se sube pensando "esta también va", no "esta va
  // primera". Reordenar es otra decisión y se hace aparte.
  const ultima = await db.portfolioPhoto.findFirst({
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  const foto = await db.portfolioPhoto.create({
    data: {
      originalKey,
      key,
      thumbKey,
      width: procesada.width,
      height: procesada.height,
      orden: (ultima?.orden ?? 0) + 1,
    },
    select: { id: true },
  });

  return NextResponse.json({ foto });
}
