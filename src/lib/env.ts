function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}. Revisá tu archivo .env`);
  return value;
}

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "Santi Cazorla Photography";

export const adminPassword = () => required("ADMIN_PASSWORD");
export const authSecret = () => required("AUTH_SECRET");

/// Dos buckets a propósito: el público se sirve por un dominio de CDN y sólo
/// contiene previews con marca de agua; el privado guarda los originales y no
/// tiene acceso público de ningún tipo.
export const r2 = () => ({
  accountId: required("R2_ACCOUNT_ID"),
  accessKeyId: required("R2_ACCESS_KEY_ID"),
  secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  publicBucket: required("R2_BUCKET_PUBLIC"),
  privateBucket: required("R2_BUCKET_PRIVATE"),
  publicUrl: required("R2_PUBLIC_URL").replace(/\/$/, ""),
});

export const mercadopago = () => ({
  accessToken: required("MP_ACCESS_TOKEN"),
  webhookSecret: process.env.MP_WEBHOOK_SECRET ?? "",
});

/// Sin R2 configurado el sitio guarda las fotos en disco, para poder trabajar
/// en local sin cuenta de Cloudflare.
export const usingLocalStorage = () => !process.env.R2_ACCOUNT_ID;
