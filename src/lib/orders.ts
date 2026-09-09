import "server-only";

import { customAlphabet } from "nanoid";

import { db } from "./db";
import { createPreference, getPayment } from "./mercadopago";

export const OrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
} as const;

const newToken = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 24);

/// Código corto que el fotógrafo le canta a un jugador para que encuentre su
/// foto. Sin vocales ni caracteres que se confundan al dictarlo por teléfono.
const newPhotoCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

export async function generatePhotoCode() {
  // Con 32^5 combinaciones el choque es rarísimo, pero igual reintentamos.
  for (let i = 0; i < 8; i++) {
    const code = newPhotoCode();
    const taken = await db.photo.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new Error("No se pudo generar un código de foto único");
}

export class OrderError extends Error {}

/**
 * Crea la orden y el link de pago. El total sale SIEMPRE del precio guardado en
 * la base, nunca de lo que mande el navegador.
 */
export async function createOrder(photoIds: string[], email: string) {
  const unique = [...new Set(photoIds)];
  if (unique.length === 0) throw new OrderError("El carrito está vacío");
  if (unique.length > 200) throw new OrderError("Demasiadas fotos en una sola compra");

  const photos = await db.photo.findMany({
    where: { id: { in: unique }, event: { published: true } },
    select: {
      id: true,
      code: true,
      event: { select: { title: true, priceArs: true } },
    },
  });

  if (photos.length !== unique.length) {
    throw new OrderError("Algunas fotos ya no están disponibles");
  }

  const totalArs = photos.reduce((sum, p) => sum + p.event.priceArs, 0);

  const order = await db.order.create({
    data: {
      token: newToken(),
      email,
      totalArs,
      status: OrderStatus.PENDING,
      items: {
        create: photos.map((p) => ({ photoId: p.id, priceArs: p.event.priceArs })),
      },
    },
  });

  const { preferenceId, checkoutUrl } = await createPreference({
    orderId: order.id,
    orderToken: order.token,
    email,
    items: photos.map((p) => ({
      id: p.id,
      title: `Foto ${p.code} · ${p.event.title}`,
      quantity: 1,
      unitPrice: p.event.priceArs,
    })),
  });

  await db.order.update({
    where: { id: order.id },
    data: { mpPreferenceId: preferenceId },
  });

  return { token: order.token, checkoutUrl };
}

/**
 * Única vía por la que una orden pasa a PAID. Le preguntamos a MercadoPago por
 * el pago; no confiamos en lo que diga quien llamó al webhook.
 */
export async function confirmPayment(paymentId: string) {
  const payment = await getPayment(paymentId);

  const orderId = payment.external_reference;
  if (!orderId) return { ok: false, reason: "sin external_reference" };

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, reason: "orden inexistente" };
  if (order.status === OrderStatus.PAID) return { ok: true, alreadyPaid: true };

  // El monto tiene que coincidir con lo que calculamos nosotros.
  const paid = Number(payment.transaction_amount ?? 0);
  if (payment.status === "approved" && paid < order.totalArs) {
    return { ok: false, reason: "monto menor al esperado" };
  }

  if (payment.status !== "approved") {
    if (payment.status === "rejected" || payment.status === "cancelled") {
      await db.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.FAILED, mpPaymentId: String(payment.id) },
      });
    }
    return { ok: false, reason: `pago ${payment.status}` };
  }

  await db.order.update({
    where: { id: order.id },
    data: {
      status: OrderStatus.PAID,
      paidAt: new Date(),
      mpPaymentId: String(payment.id),
    },
  });

  return { ok: true, alreadyPaid: false };
}
