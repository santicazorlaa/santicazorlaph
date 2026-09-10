import { NextResponse } from "next/server";
import { z } from "zod";

import { createOrder, OrderError } from "@/lib/orders";

const schema = z.object({
  email: z.string().email("Necesitamos un email válido para mandarte las fotos"),
  // Opcional de verdad: las fotos llegan por mail igual. Sólo sirve para que
  // Santi sepa a quién etiquetar cuando publica.
  instagram: z.string().max(60).optional(),
  // Sólo mandamos los IDs. El precio y el total los calcula el servidor.
  photoIds: z.array(z.string().min(1)).min(1, "El carrito está vacío"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  try {
    const { token, checkoutUrl } = await createOrder(
      parsed.data.photoIds,
      parsed.data.email,
      parsed.data.instagram,
    );
    return NextResponse.json({ token, checkoutUrl });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("checkout falló", error);
    return NextResponse.json(
      { error: "No pudimos crear el pago. Probá de nuevo en un momento." },
      { status: 500 },
    );
  }
}
