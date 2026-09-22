import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { esTipoDeEvento, FORMA_DE_VISITANTE } from "@/lib/actividad-entrega";
import { entregaAutorizada } from "@/lib/auth";
import { db } from "@/lib/db";
import { ipDe, superaLimite } from "@/lib/limite";

export const dynamic = "force-dynamic";

const schema = z.object({
  tipo: z.string().max(20),
  photoId: z.string().max(40).optional().nullable(),
  visitante: z.string().max(64).optional().nullable(),
});

type Props = { params: Promise<{ slug: string }> };

const UNA_HORA = 60 * 60;

/// Cuántas anotaciones se aceptan por hora desde una misma dirección en una
/// misma entrega.
///
/// El número es alto a propósito: **un equipo entero comparte el wifi del club
/// y sale por una sola dirección**. Con un tope ajustado, los primeros tres
/// jugadores que recorrieran el lote se comían la cuota y la mitad de la tarde
/// quedaba sin registrar, que es peor que no tener la pantalla. Para entrar
/// hace falta el PIN igual, así que esto es un freno contra un accidente, no
/// contra un desconocido.
const TOPE_POR_HORA = 3000;

/**
 * Anota algo que pasó en una entrega.
 *
 * Existe porque las descargas **no pasan por el servidor**: los dos botones
 * apuntan derecho a Google, así que sin este aviso no hay forma de saber que
 * alguien bajó una foto. Es una anotación y nada más: no devuelve nada, no
 * habilita nada y no cambia nada de lo que ve el que la manda.
 *
 * Exige el mismo pase de PIN que la galería, por dos motivos: nadie de afuera
 * puede ensuciar los números de Santi, y no se anota actividad de alguien que
 * no podría estar viendo las fotos.
 */
export async function POST(request: Request, { params }: Props) {
  const { slug } = await params;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !esTipoDeEvento(parsed.data.tipo)) {
    return new NextResponse(null, { status: 204 });
  }
  const { tipo, photoId } = parsed.data;

  const entrega = await db.clientDelivery.findUnique({
    where: { slug, published: true },
    select: { id: true, pin: true },
  });
  if (!entrega) return new NextResponse(null, { status: 204 });

  if (!(await entregaAutorizada(entrega))) {
    return new NextResponse(null, { status: 204 });
  }

  if (await superaLimite(`ev:${entrega.id}:${ipDe(request)}`, TOPE_POR_HORA, UNA_HORA)) {
    return new NextResponse(null, { status: 204 });
  }

  // El número de visitante lo trae el navegador. Es al azar y no dice nada de
  // nadie: lo único que permite es contar personas en vez de clics. Si no viene
  // o viene con mala forma, se anota igual con uno suelto: perder el renglón
  // sería peor que contar una persona de más.
  const visitante =
    parsed.data.visitante && FORMA_DE_VISITANTE.test(parsed.data.visitante)
      ? parsed.data.visitante
      : randomUUID();

  // El código se copia al evento. La foto puede desaparecer de Drive y la
  // sincronización borrarla, y entonces el renglón quedaría sin poder decir de
  // cuál era. Además confirma que la foto es de esta entrega y no de otra.
  let codigo: string | null = null;
  let photoIdValido: string | null = null;
  if (photoId) {
    const foto = await db.deliveryPhoto.findFirst({
      where: { id: photoId, deliveryId: entrega.id },
      select: { id: true, code: true },
    });
    // Una foto que no es de esta entrega no se anota como si no tuviera foto:
    // se descarta el aviso entero. Si no, mandando cualquier cosa se llenaba la
    // lista de "Miró una foto" sin foto, que no se entiende y no sirve.
    if (!foto) return new NextResponse(null, { status: 204 });
    photoIdValido = foto.id;
    codigo = foto.code;
  }

  try {
    await db.deliveryEvent.create({
      data: { deliveryId: entrega.id, photoId: photoIdValido, codigo, tipo, visitante },
    });
  } catch {
    // Si la base falla, se pierde la anotación y se sigue. Que no se pueda
    // contar una descarga nunca puede ser un problema para el que la hizo.
  }

  return new NextResponse(null, { status: 204 });
}
