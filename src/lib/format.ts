const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function precio(pesos: number) {
  return money.format(pesos);
}

const fechaLarga = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

const fechaCorta = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

const hora = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Buenos_Aires",
});

export const fecha = (d: Date) => fechaLarga.format(d);
export const fechaBreve = (d: Date) => fechaCorta.format(d);
export const horaDe = (d: Date) => hora.format(d);

/**
 * "hace 2 días", para avisar que un partido se actualizó recién. Se corta en la
 * semana: pasado ese punto la antigüedad ya no dice nada útil y la fecha del
 * partido, que está al lado, cuenta mejor la historia.
 */
export function hace(d: Date): string | null {
  const minutos = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutos < 0) return null;
  if (minutos < 60) return "recién";
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${plural(horas, "hora", "horas")}`;
  const dias = Math.floor(horas / 24);
  if (dias <= 7) return `hace ${plural(dias, "día", "días")}`;
  return null;
}

export function plural(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/// Slug para la URL del evento: "CAT vs Lastenia" -> "cat-vs-lastenia"
export function slugify(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca los acentos que dejó el normalize
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
