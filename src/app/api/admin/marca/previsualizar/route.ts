import { NextResponse } from "next/server";
import sharp from "sharp";

import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { acotarOpacidad, leerOpacidades } from "@/lib/ajustes";
import { getObject } from "@/lib/storage";
import { renderPreview } from "@/lib/watermark";

export const maxDuration = 60;

/// Una cancha genérica, para cuando todavía no hay ninguna foto cargada.
function canchaDeEjemplo() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600">
    <defs>
      <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d5e4f0"/><stop offset="100%" stop-color="#9db8cd"/>
      </linearGradient>
      <linearGradient id="p" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#548a45"/><stop offset="100%" stop-color="#1d3a19"/>
      </linearGradient>
    </defs>
    <rect width="2400" height="620" fill="url(#c)"/>
    <rect y="620" width="2400" height="980" fill="url(#p)"/>
    <rect y="700" width="2400" height="9" fill="#fff" opacity="0.6"/>
    <circle cx="1200" cy="1150" r="270" fill="none" stroke="#fff" stroke-width="9" opacity="0.4"/>
    <rect x="1050" y="820" width="150" height="380" rx="22" fill="#16243d"/>
    <circle cx="1125" cy="770" r="60" fill="#c98d63"/>
    <circle cx="1330" cy="1290" r="42" fill="#fbfbfb"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

/**
 * Aplica la marca de agua actual sobre una foto real ya cargada (o sobre una
 * cancha de ejemplo si todavía no hay ninguna) y devuelve el resultado.
 *
 * Usa exactamente el mismo render que la vista ampliada del sitio, así que lo
 * que se ve acá es lo que van a ver los compradores.
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ultima = await db.photo.findFirst({
    orderBy: { createdAt: "desc" },
    select: { originalKey: true },
  });

  let original: Buffer | null = null;
  if (ultima) {
    original = await getObject("private", ultima.originalKey).catch(() => null);
  }
  original ??= await canchaDeEjemplo();

  // Si vienen en la dirección, se usan esas: así el panel muestra cómo queda
  // el control antes de guardarlo.
  const params = new URL(request.url).searchParams;
  const pedido = (campo: string) => {
    const n = Number(params.get(campo));
    return Number.isFinite(n) && params.get(campo) !== null ? acotarOpacidad(n / 100) : null;
  };
  const guardadas = await leerOpacidades();
  const preview = await renderPreview(original, {
    mosaico: pedido("mosaico") ?? guardadas.mosaico,
    centro: pedido("centro") ?? guardadas.centro,
  });

  return new NextResponse(new Uint8Array(preview), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
