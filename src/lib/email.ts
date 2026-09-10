import "server-only";

import { Resend } from "resend";

import { db } from "./db";
import { siteName, siteUrl } from "./env";
import { precio } from "./format";
import { publicUrl } from "./storage";

const GRIS = "#5c626d";
const TINTA = "#15171b";
const AMBAR = "#a85e12";

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * El mail se arma con tablas y estilos en línea porque los clientes de correo
 * no soportan CSS moderno. Y el texto tiene que funcionar solo: muchos clientes
 * bloquean las imágenes hasta que el lector las habilita.
 */
function armarHtml(datos: {
  urlCompra: string;
  fotos: { code: string; thumbUrl: string }[];
  totalArs: number;
  eventos: string[];
}) {
  const { urlCompra, fotos, totalArs, eventos } = datos;

  const miniaturas = fotos
    .slice(0, 6)
    .map(
      (f) => `<td style="padding:0 6px 12px 0;">
        <img src="${escapar(f.thumbUrl)}" width="150" alt="Foto ${escapar(f.code)}"
             style="display:block;width:150px;border-radius:4px;border:0;" />
      </td>`,
    )
    .join("");

  const restantes = fotos.length - Math.min(fotos.length, 6);

  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f2f2f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f0;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

        <tr><td style="background:${TINTA};padding:22px 28px;">
          <img src="${siteUrl}/logo-email.png" width="220" alt="${escapar(siteName)}"
               style="display:block;width:220px;border:0;" />
        </td></tr>

        <tr><td style="padding:32px 28px 8px;">
          <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:${TINTA};">
            Tus fotos están listas
          </h1>
          <p style="margin:0 0 6px;font-size:15px;line-height:1.55;color:${GRIS};">
            Gracias por tu compra. Descargá tus fotos en resolución completa y sin
            marca de agua desde este link.
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:${GRIS};">
            <strong style="color:${TINTA};">Guardá este mail.</strong> El link es tuyo
            y no vence: podés volver cuando quieras y descargarlas de nuevo.
          </p>
        </td></tr>

        <tr><td style="padding:0 28px 24px;">
          <a href="${escapar(urlCompra)}"
             style="display:inline-block;background:${AMBAR};color:#ffffff;text-decoration:none;
                    font-size:15px;font-weight:bold;padding:15px 34px;border-radius:6px;">
            Descargar mis fotos
          </a>
        </td></tr>

        ${
          fotos.length > 0
            ? `<tr><td style="padding:0 28px 8px;">
                 <table role="presentation" cellpadding="0" cellspacing="0"><tr>${miniaturas}</tr></table>
                 ${
                   restantes > 0
                     ? `<p style="margin:0;font-size:13px;color:${GRIS};">y ${restantes} más</p>`
                     : ""
                 }
               </td></tr>`
            : ""
        }

        <tr><td style="padding:16px 28px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="border-top:1px solid #e2e2df;padding-top:16px;">
            <tr><td style="font-size:13px;color:${GRIS};padding-top:16px;">
              ${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"} · ${precio(totalArs)}<br>
              ${escapar(eventos.join(" · "))}
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="background:#f7f7f5;padding:18px 28px;font-size:12px;color:${GRIS};">
          Si el botón no funciona, copiá esta dirección en tu navegador:<br>
          <span style="color:${TINTA};word-break:break-all;">${escapar(urlCompra)}</span>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function armarTexto(datos: { urlCompra: string; cantidad: number; totalArs: number }) {
  return [
    "Tus fotos están listas.",
    "",
    "Descargalas en resolución completa y sin marca de agua desde este link:",
    datos.urlCompra,
    "",
    `${datos.cantidad} ${datos.cantidad === 1 ? "foto" : "fotos"} · ${precio(datos.totalArs)}`,
    "",
    "Guardá este mail: el link es tuyo y no vence.",
    "",
    siteName,
  ].join("\n");
}

/// Arma el mail sin mandarlo. Separado del envío para poder previsualizarlo.
export async function construirMailDeCompra(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          photo: { select: { code: true, thumbKey: true, event: { select: { title: true } } } },
        },
      },
    },
  });
  if (!order) return null;

  const urlCompra = `${siteUrl}/compra/${order.token}`;
  const fotos = order.items.map((i) => ({
    code: i.photo.code,
    thumbUrl: publicUrl(i.photo.thumbKey),
  }));
  const eventos = [...new Set(order.items.map((i) => i.photo.event.title))];

  return {
    to: order.email,
    subject: `Tus fotos de ${eventos[0] ?? "tu partido"} están listas`,
    html: armarHtml({ urlCompra, fotos, totalArs: order.totalArs, eventos }),
    text: armarTexto({
      urlCompra,
      cantidad: order.items.length,
      totalArs: order.totalArs,
    }),
    urlCompra,
  };
}

/**
 * Le manda al comprador el link de sus fotos. Nunca lanza: si el mail falla, la
 * compra ya está acreditada y el comprador tiene la página abierta — perder el
 * mail es molesto, pero tirar abajo la confirmación del pago sería mucho peor.
 */
export async function enviarMailDeCompra(orderId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  const mail = await construirMailDeCompra(orderId);
  if (!mail) return { ok: false, motivo: "orden inexistente" };
  const { urlCompra } = mail;

  if (!apiKey || !from) {
    console.warn(
      `[mail] sin RESEND_API_KEY o MAIL_FROM: no se envió el mail de la orden ${orderId}. Link: ${urlCompra}`,
    );
    return { ok: false, motivo: "sin configurar" };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (error) {
      console.error(`[mail] falló el envío de la orden ${orderId}`, error);
      return { ok: false, motivo: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[mail] error inesperado en la orden ${orderId}`, e);
    return { ok: false, motivo: "excepción" };
  }
}

async function obtenerDestinatarioAdmin() {
  if (process.env.ADMIN_EMAIL?.trim()) return process.env.ADMIN_EMAIL.trim();
  const ajuste = await db.ajuste
    .findUnique({ where: { clave: "contacto.email" } })
    .catch(() => null);
  if (ajuste?.valor?.trim()) return ajuste.valor.trim();
  const match = process.env.MAIL_FROM?.match(/<([^>]+)>/);
  return match ? match[1] : process.env.MAIL_FROM;
}

/**
 * Notifica a Santi por correo cuando se acredita una compra.
 * Incluye el nombre completo del comprador (obtenido de MercadoPago), su email,
 * su Instagram (si lo dejó), el monto y las fotos adquiridas.
 */
export async function enviarNotificacionDeVenta(orderId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) return { ok: false, motivo: "sin configurar" };

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          photo: { select: { code: true, event: { select: { title: true } } } },
        },
      },
    },
  });
  if (!order) return { ok: false, motivo: "orden inexistente" };

  const destino = await obtenerDestinatarioAdmin();
  if (!destino) {
    console.warn("[mail-admin] no hay email configurado para recibir avisos de ventas");
    return { ok: false, motivo: "sin destinatario" };
  }

  const eventos = [...new Set(order.items.map((i) => i.photo.event.title))];
  const nombre = order.buyerName?.trim() || "No informado por MercadoPago";
  const ig = order.instagram ? `@${order.instagram}` : "No dejó Instagram";
  const cantFotos = order.items.length;
  const total = precio(order.totalArs);
  const panelVentasUrl = `${siteUrl}/admin/ventas`;

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f2f2f0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f0;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:${TINTA};padding:20px 28px;">
          <h2 style="margin:0;color:#ffffff;font-size:20px;">🎉 ¡Nueva venta de fotos!</h2>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;font-size:16px;color:${TINTA};">
            Acaba de ingresar una venta por <strong>${escapar(total)}</strong>.
          </p>
          <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="background:#f7f7f5;border-radius:6px;font-size:14px;color:${TINTA};margin-bottom:24px;">
            <tr><td style="color:${GRIS};width:140px;">Comprador:</td><td><strong>${escapar(nombre)}</strong></td></tr>
            <tr><td style="color:${GRIS};">Email:</td><td>${escapar(order.email)}</td></tr>
            <tr><td style="color:${GRIS};">Instagram:</td><td>${escapar(ig)}</td></tr>
            <tr><td style="color:${GRIS};">Fotos:</td><td>${cantFotos} ${cantFotos === 1 ? "foto" : "fotos"} (${escapar(eventos.join(" · "))})</td></tr>
            <tr><td style="color:${GRIS};">Total cobrado:</td><td><strong style="color:${AMBAR};">${escapar(total)}</strong></td></tr>
          </table>
          <a href="${escapar(panelVentasUrl)}"
             style="display:inline-block;background:${TINTA};color:#ffffff;text-decoration:none;
                    font-size:14px;font-weight:bold;padding:12px 24px;border-radius:6px;">
            Ver en el panel de ventas →
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    "¡Nueva venta de fotos confirmada!",
    "",
    `Comprador: ${nombre}`,
    `Email: ${order.email}`,
    `Instagram: ${ig}`,
    `Fotos: ${cantFotos} (${eventos.join(" · ")})`,
    `Total cobrado: ${total}`,
    "",
    `Ver en el panel: ${panelVentasUrl}`,
  ].join("\n");

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: destino,
      subject: `🎉 Nueva venta: ${nombre} compró ${cantFotos} fotos (${total})`,
      html,
      text,
    });
    if (error) {
      console.error(`[mail-admin] falló el aviso de venta ${orderId}`, error);
      return { ok: false, motivo: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[mail-admin] excepción al enviar aviso de venta ${orderId}`, e);
    return { ok: false, motivo: "excepción" };
  }
}
