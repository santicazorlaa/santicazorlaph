import { NextResponse } from "next/server";
import sharp from "sharp";

import { isAdmin } from "@/lib/auth";
import { leerContenido, guardarContenido, type Clave } from "@/lib/contenido";
import { deleteObject, putObject } from "@/lib/storage";
import { renderTapa } from "@/lib/watermark";

/// Las dos imágenes del sitio que no salen de un partido. Cada una se
/// reprocesa acá con su propia medida: la tapa se ve de lado a lado y el
/// retrato en una columna.
const CAMPOS: Record<string, { clave: Clave; render: (b: Buffer) => Promise<Buffer> }> = {
  tapa: {
    clave: "hero.fotoKey",
    render: renderTapa,
  },
  retrato: {
    clave: "sobre.fotoKey",
    render: (b) =>
      sharp(b, { failOn: "none" })
        .rotate()
        .resize({ width: 900, withoutEnlargement: true })
        .jpeg({ quality: 72, progressive: true, mozjpeg: true })
        .toBuffer(),
  },
};

/**
 * Sube la tapa del sitio o el retrato de Santi.
 *
 * El navegador ya achica la imagen antes de mandarla —Vercel rechaza cualquier
 * petición de más de 4,5 MB y las fotos de la cámara pesan mucho más—, así que
 * lo que llega acá es chico. Igual se vuelve a procesar del lado del servidor:
 * es lo único que garantiza el tamaño y la compresión con los que sale al aire.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await request.formData();
  const campo = CAMPOS[String(form.get("campo") ?? "")];
  const archivo = form.get("archivo");

  if (!campo) return NextResponse.json({ error: "Campo desconocido" }, { status: 400 });
  if (!(archivo instanceof File) || archivo.size === 0) {
    return NextResponse.json({ error: "No llegó ninguna imagen" }, { status: 400 });
  }

  let procesada: Buffer;
  try {
    procesada = await campo.render(Buffer.from(await archivo.arrayBuffer()));
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer esa imagen. Probá con un JPG o un PNG." },
      { status: 400 },
    );
  }

  // Clave nueva en cada cambio, porque lo público se publica con caché de un
  // año: pisar la misma dejaría la imagen vieja dando vueltas por meses.
  const anterior = (await leerContenido())[campo.clave];
  const key = `sitio/${campo.clave.replace(".", "-")}.${Date.now().toString(36)}.jpg`;
  await putObject("public", key, procesada, "image/jpeg");

  await guardarContenido({ [campo.clave]: key });

  if (anterior && anterior !== key && anterior.startsWith("sitio/")) {
    await deleteObject("public", anterior).catch(() => {});
  }

  return NextResponse.json({ ok: true, key });
}
