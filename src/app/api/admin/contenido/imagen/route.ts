import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth";
import { leerContenido, guardarContenido, type Clave } from "@/lib/contenido";
import {
  leerEncuadre,
  TAPA_CELULAR,
  TAPA_ESCRITORIO,
  type Encuadre,
} from "@/lib/encuadre";
import { deleteObject, getObject, putObject } from "@/lib/storage";
import { renderRetrato, renderTapa } from "@/lib/watermark";

/**
 * Sube y encuadra las dos imágenes del sitio que no salen de un partido: la
 * tapa del encabezado y el retrato de Santi.
 *
 * El navegador ya achica la imagen antes de mandarla —Vercel rechaza cualquier
 * petición de más de 4,5 MB y las fotos de la cámara pesan mucho más—, así que
 * lo que llega acá es chico. Igual se vuelve a procesar del lado del servidor:
 * es lo único que garantiza el tamaño y el recorte con los que sale al aire.
 *
 * La tapa se publica dos veces, con dos recortes distintos de la misma foto:
 * una franja ancha para escritorio y un rectángulo alto para el celular. El
 * `GET` devuelve la foto original guardada para que el editor del panel la
 * muestre y Santi pueda reencuadrarla sin volver a subirla.
 */

/// Dónde vive el archivo tal como se subió, para poder rehacer los recortes.
const ORIGEN: Record<string, Clave> = {
  tapa: "hero.origenKey",
  retrato: "sobre.origenKey",
};

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const clave = ORIGEN[new URL(request.url).searchParams.get("campo") ?? ""];
  if (!clave) return NextResponse.json({ error: "Campo desconocido" }, { status: 400 });

  const key = (await leerContenido())[clave];
  if (!key) return NextResponse.json({ error: "No hay imagen guardada" }, { status: 404 });

  const archivo = await getObject("private", key);
  return new Response(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "image/jpeg",
      // Es la foto original de Santi y sólo la ve él, ya autenticado: que no
      // quede en ningún caché intermedio.
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await request.formData();
  const campo = String(form.get("campo") ?? "");
  const archivo = form.get("archivo");
  const contenido = await leerContenido();

  if (!ORIGEN[campo]) {
    return NextResponse.json({ error: "Campo desconocido" }, { status: 400 });
  }

  // Si no viene archivo es un reencuadre: la foto ya está guardada y sólo
  // cambia qué pedazo se muestra. Es lo que evita que Santi tenga que volver a
  // subir la misma foto para correr el recorte dos dedos.
  let subido: Buffer | null = null;
  if (archivo instanceof File && archivo.size > 0) {
    subido = Buffer.from(await archivo.arrayBuffer());
  } else {
    const origen = contenido[ORIGEN[campo]];
    if (!origen) {
      return NextResponse.json({ error: "No llegó ninguna imagen" }, { status: 400 });
    }
    subido = await getObject("private", origen);
  }

  const sello = Date.now().toString(36);
  const nuevos: Partial<Record<Clave, string>> = {};
  const aBorrar: string[] = [];

  /// Publica una imagen en una dirección nueva y deja anotada la vieja para
  /// borrarla. La dirección tiene que ser nueva sí o sí: lo público se sirve
  /// con caché de un año, así que pisar el mismo archivo dejaría al CDN
  /// mostrando el recorte anterior durante meses.
  async function publicar(clave: Clave, sufijo: string, imagen: Buffer) {
    const key = `sitio/${clave.replace(".", "-")}.${sello}${sufijo}.jpg`;
    await putObject("public", key, imagen, "image/jpeg");
    nuevos[clave] = key;
    const anterior = contenido[clave];
    if (anterior && anterior !== key && anterior.startsWith("sitio/")) aBorrar.push(anterior);
  }

  try {
    if (campo === "tapa") {
      const escritorio = encuadreDelFormulario(form, "encuadreEscritorio");
      const celular = encuadreDelFormulario(form, "encuadreCelular");

      await publicar("hero.fotoKey", "", await renderTapa(subido, TAPA_ESCRITORIO, escritorio));
      await publicar(
        "hero.fotoKeyCelular",
        "-cel",
        await renderTapa(subido, TAPA_CELULAR, celular),
      );

      nuevos["hero.encuadreEscritorio"] = form.get("encuadreEscritorio")?.toString() ?? "";
      nuevos["hero.encuadreCelular"] = form.get("encuadreCelular")?.toString() ?? "";
    } else {
      await publicar("sobre.fotoKey", "", await renderRetrato(subido));
    }
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer esa imagen. Probá con un JPG o un PNG." },
      { status: 400 },
    );
  }

  // El archivo tal como llegó va al bucket privado. Ocupa poco y es lo que
  // permite rehacer los recortes sin volver a pedírsela a Santi. Sólo se
  // reescribe cuando la foto es nueva: en un reencuadre ya está donde va.
  if (archivo instanceof File && archivo.size > 0) {
    const origenKey = `sitio-originales/${ORIGEN[campo].replace(".", "-")}.${sello}`;
    await putObject("private", origenKey, subido, archivo.type || "image/jpeg");
    nuevos[ORIGEN[campo]] = origenKey;
  }

  await guardarContenido(nuevos);

  for (const key of aBorrar) await deleteObject("public", key).catch(() => {});

  return NextResponse.json({ ok: true });
}

function encuadreDelFormulario(form: FormData, campo: string): Encuadre | null {
  const texto = form.get(campo);
  return typeof texto === "string" && texto ? leerEncuadre(texto) : null;
}
