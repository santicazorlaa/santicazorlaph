import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

import { mercadopago as mpEnv, siteUrl } from "./env";

function client() {
  return new MercadoPagoConfig({ accessToken: mpEnv().accessToken });
}

export type PreferenceItem = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number;
};

/// MercadoPago no acepta localhost como dirección de retorno, y con una URL que
/// no le sirve rechaza toda la preferencia. En desarrollo el comprador vuelve
/// con el botón de MercadoPago en vez de volver solo.
const esPublico = !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(siteUrl);

export async function createPreference(opts: {
  orderId: string;
  orderToken: string;
  email: string;
  items: PreferenceItem[];
}) {
  const preference = new Preference(client());

  const res = await preference.create({
    body: {
      items: opts.items.map((i) => ({
        id: i.id,
        title: i.title,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        currency_id: "ARS",
      })),
      payer: { email: opts.email },
      // La orden queda atada a la preferencia por acá. Es lo que usamos para
      // reencontrarla cuando entra el webhook.
      external_reference: opts.orderId,
      ...(esPublico
        ? {
            back_urls: {
              success: `${siteUrl}/compra/${opts.orderToken}`,
              pending: `${siteUrl}/compra/${opts.orderToken}`,
              failure: `${siteUrl}/carrito?pago=rechazado`,
            },
            auto_return: "approved" as const,
            notification_url: `${siteUrl}/api/webhooks/mercadopago`,
          }
        : {}),
      statement_descriptor: "SANTICAZORLAPH",
    },
  });

  if (!res.id || !res.init_point) {
    throw new Error("MercadoPago no devolvió un link de pago");
  }

  return { preferenceId: res.id, checkoutUrl: res.init_point };
}

export async function getPayment(paymentId: string) {
  const payment = new Payment(client());
  return payment.get({ id: paymentId });
}

/**
 * MercadoPago firma cada notificación. Sin esta verificación, cualquiera que
 * conozca la URL del webhook podría avisar "pago aprobado" y llevarse las fotos.
 *
 * El manifiesto que hay que firmar está definido por MercadoPago:
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 */
export function verifyWebhookSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}) {
  const secret = mpEnv().webhookSecret;
  // Sin secreto configurado no podemos verificar nada: rechazamos en producción
  // y dejamos pasar en desarrollo para poder probar con la CLI de MercadoPago.
  if (!secret) return process.env.NODE_ENV !== "production";

  if (!opts.signatureHeader || !opts.dataId) return false;

  const parts = Object.fromEntries(
    opts.signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // Ventana de 10 minutos para que no se puedan reenviar notificaciones viejas.
  const age = Math.abs(Date.now() - Number(ts) * 1000);
  if (!Number.isFinite(age) || age > 10 * 60 * 1000) return false;

  const manifest = `id:${opts.dataId.toLowerCase()};request-id:${opts.requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
