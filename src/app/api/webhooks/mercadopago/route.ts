import { NextResponse } from "next/server";

import { confirmPayment } from "@/lib/orders";
import { verifyWebhookSignature } from "@/lib/mercadopago";

/**
 * Acá es donde una orden pasa a estar pagada. Nada de lo que venga del navegador
 * del comprador cambia el estado: sólo este webhook, y sólo después de
 * verificar la firma y de preguntarle a MercadoPago por el pago.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    action?: string;
    data?: { id?: string };
  };

  const dataId = body.data?.id ?? url.searchParams.get("data.id");
  const tipo = body.type ?? url.searchParams.get("type");

  const firmaOk = verifyWebhookSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
  });

  if (!firmaOk) {
    console.warn("webhook con firma inválida", { dataId, tipo });
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  // MercadoPago manda varios tipos de evento; sólo nos interesan los pagos.
  if (tipo !== "payment" || !dataId) {
    return NextResponse.json({ ignorado: true });
  }

  try {
    const resultado = await confirmPayment(dataId);
    if (!resultado.ok) {
      console.info("pago no acreditado", { dataId, motivo: resultado.reason });
    }
    // Siempre 200: si devolvemos error, MercadoPago reintenta en loop.
    return NextResponse.json({ recibido: true });
  } catch (error) {
    console.error("error procesando webhook", error);
    // Acá sí queremos el reintento, porque fue una falla nuestra.
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
