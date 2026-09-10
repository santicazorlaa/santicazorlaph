import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth";
import { leerContenido, guardarContenido, type Clave } from "@/lib/contenido";
import { deleteObject, putObject } from "@/lib/storage";
import { renderRetrato, renderTapa } from "@/lib/watermark";

/// Las dos imágenes del sitio que no salen de un partido. Cada una se
/// reprocesa acá con su propia medida: la tapa se ve de lado a lado y el
/// retrato en una columna.
const CAMPOS: Record<
  string,
  { clave: Clave; origen: Clave; render: (b: Buffer) => Promise<Buffer> }
> = {
  tapa: {
    clave: "hero.fotoKey",
    origen: "hero.origenKey",
    render: renderTapa,
  },
  retrato: {
    clave: "sobre.fotoKey",
    origen: "sobre.origenKey",
    render: renderRetrato,
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

  const subido = Buffer.from(await archivo.arrayBuffer());

  let procesada: Buffer;
  try {
    procesada = await campo.render(subido);
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer esa imagen. Probá con un JPG o un PNG." },
      { status: 400 },
    );
  }

  // Clave nueva en cada cambio, porque lo público se publica con caché de un
  // año: pisar la misma dejaría la imagen vieja dando vueltas por meses.
  const anterior = (await leerContenido())[campo.clave];
  const sello = Date.now().toString(36);
  const key = `sitio/${campo.clave.replace(".", "-")}.${sello}.jpg`;
  await putObject("public", key, procesada, "image/jpeg");

  // El archivo tal como llegó va al bucket privado. Ocupa poco y es lo que
  // permite rehacer la imagen con otra medida sin volver a pedírsela a Santi.
  const origenKey = `sitio-originales/${campo.origen.replace(".", "-")}.${sello}`;
  await putObject("private", origenKey, subido, archivo.type || "image/jpeg");

  await guardarContenido({ [campo.clave]: key, [campo.origen]: origenKey });

  if (anterior && anterior !== key && anterior.startsWith("sitio/")) {
    await deleteObject("public", anterior).catch(() => {});
  }

  return NextResponse.json({ ok: true, key });
}
