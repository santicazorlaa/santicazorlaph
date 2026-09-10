import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { PrecioPartido } from "@/components/precio-partido";
import { Uploader } from "@/components/uploader";
import { leerEscalones } from "@/lib/ajustes";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { fechaBreve, plural } from "@/lib/format";
import { guardarContenido, leerContenido } from "@/lib/contenido";
import { deleteObject, getObject, publicUrl, putObject } from "@/lib/storage";
import { TAPA_CELULAR, TAPA_ESCRITORIO } from "@/lib/encuadre";
import { renderPortada, renderPortfolio, renderTapa } from "@/lib/watermark";

export const dynamic = "force-dynamic";
/// Elegir portada baja el original del bucket y lo vuelve a procesar, que tarda
/// más que lo que Vercel le da a una petición común.
export const maxDuration = 60;
export const metadata: Metadata = { title: "Editar partido", robots: { index: false } };

type Props = { params: Promise<{ id: string }> };

async function guardarPrecio(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("eventId") ?? "");
  const pedido = Number(formData.get("priceArs"));
  if (!id || !Number.isFinite(pedido) || pedido < 1) return;

  await db.event.update({ where: { id }, data: { priceArs: Math.round(pedido) } });

  // Las compras ya hechas no se tocan: cada renglón de una orden guarda el
  // precio que la foto tenía ese día.
  revalidatePath(`/admin/evento/${id}`);
  revalidatePath("/");
}

async function guardarDetalles(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("eventId") ?? "");
  if (!id) return;

  const category = String(formData.get("category") ?? "").trim();
  const packTexto = String(formData.get("packPriceArs") ?? "").trim();
  const pack = packTexto === "" ? null : Number(packTexto);

  await db.event.update({
    where: { id },
    data: {
      category: category || null,
      // Vacío saca el pack. Un número inválido no se guarda: mejor dejar el
      // valor anterior que guardar un precio que no tiene sentido.
      ...(packTexto === "" || (Number.isFinite(pack) && pack! >= 1)
        ? { packPriceArs: pack }
        : {}),
    },
  });

  revalidatePath(`/admin/evento/${id}`);
  revalidatePath("/");
  revalidatePath("/carrito");
}

async function usarDePortada(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const photoId = String(formData.get("photoId") ?? "");
  // De qué partido es lo dice la foto, no el formulario: así no hay manera de
  // pedir la foto de un partido como portada de otro.
  const foto = await db.photo.findUnique({
    where: { id: photoId },
    select: { originalKey: true, eventId: true },
  });
  if (!foto) return;

  const id = foto.eventId;
  const anterior = (
    await db.event.findUnique({ where: { id }, select: { coverKey: true } })
  )?.coverKey;

  const original = await getObject("private", foto.originalKey);
  const portada = await renderPortada(original);

  // Clave nueva en cada cambio: las fotos públicas se publican con caché de un
  // año, así que pisar la misma dejaría la portada vieja dando vueltas.
  const coverKey = `portada/${id}/${photoId}.${Date.now().toString(36)}.jpg`;
  await putObject("public", coverKey, portada, "image/jpeg");

  await db.event.update({ where: { id }, data: { coverKey } });

  // Recién con la base apuntando a la nueva se borra la anterior, y sólo si era
  // una portada: antes de que esto existiera podía apuntar a una miniatura que
  // se sigue usando en la galería.
  if (anterior && anterior !== coverKey && anterior.startsWith("portada/")) {
    await deleteObject("public", anterior).catch(() => {});
  }

  revalidatePath(`/admin/evento/${id}`);
  revalidatePath("/");
}


/**
 * Marca o desmarca una foto para el portfolio de la portada.
 *
 * Al marcarla se genera una versión limpia y chica, del mismo tamaño que una
 * portada: un portfolio con marca de agua no muestra nada, pero a 500 px es
 * mirar y no llevarse. Al desmarcarla el archivo se borra, así el bucket no
 * junta versiones sin marca de fotos que ya no se muestran.
 */
async function alternarPortfolio(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const photoId = String(formData.get("photoId") ?? "");
  const foto = await db.photo.findUnique({
    where: { id: photoId },
    select: { originalKey: true, eventId: true, destacada: true, portfolioKey: true },
  });
  if (!foto) return;

  if (foto.destacada) {
    await db.photo.update({
      where: { id: photoId },
      data: { destacada: false, portfolioKey: null },
    });
    if (foto.portfolioKey) await deleteObject("public", foto.portfolioKey).catch(() => {});
  } else {
    const original = await getObject("private", foto.originalKey);
    const key = `portfolio/${photoId}.${Date.now().toString(36)}.jpg`;
    await putObject("public", key, await renderPortfolio(original), "image/jpeg");
    await db.photo.update({
      where: { id: photoId },
      data: { destacada: true, portfolioKey: key },
    });
  }

  revalidatePath(`/admin/evento/${foto.eventId}`);
  revalidatePath("/");
}

/// Usa esta foto de fondo del encabezado del sitio. Sale del original, así que
/// queda mejor que subir una imagen ya achicada desde el panel.
async function usarDeTapa(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const photoId = String(formData.get("photoId") ?? "");
  const foto = await db.photo.findUnique({
    where: { id: photoId },
    select: { originalKey: true, eventId: true },
  });
  if (!foto) return;

  const contenido = await leerContenido();
  const original = await getObject("private", foto.originalKey);
  const sello = Date.now().toString(36);

  // Los dos recortes, centrados. Desde acá se elige la foto, no cómo se
  // encuadra: eso se acomoda después en el panel de contenido, que muestra
  // cómo va a quedar en cada pantalla.
  const key = `sitio/hero-fotoKey.${sello}.jpg`;
  const keyCelular = `sitio/hero-fotoKeyCelular.${sello}.jpg`;
  await putObject("public", key, await renderTapa(original, TAPA_ESCRITORIO, null), "image/jpeg");
  await putObject(
    "public",
    keyCelular,
    await renderTapa(original, TAPA_CELULAR, null),
    "image/jpeg",
  );

  // El original de la foto queda como origen de la tapa: es de donde salen los
  // recortes cuando Santi los acomoda, sin tener que subir nada. Los encuadres
  // que hubiera se limpian, porque eran de otra foto.
  await guardarContenido({
    "hero.fotoKey": key,
    "hero.fotoKeyCelular": keyCelular,
    "hero.origenKey": foto.originalKey,
    "hero.encuadreEscritorio": "",
    "hero.encuadreCelular": "",
  });

  for (const anterior of [contenido["hero.fotoKey"], contenido["hero.fotoKeyCelular"]]) {
    if (anterior && anterior !== key && anterior.startsWith("sitio/")) {
      await deleteObject("public", anterior).catch(() => {});
    }
  }

  revalidatePath(`/admin/evento/${foto.eventId}`);
  revalidatePath("/", "layout");
}

export default async function AdminEventoPage({ params }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;

  const evento = await db.event.findUnique({
    where: { id },
    include: {
      _count: { select: { photos: true } },
      photos: {
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { id: true, code: true, thumbKey: true, destacada: true },
      },
    },
  });
  if (!evento) notFound();

  const escalones = await leerEscalones();

  async function alternarPublicado() {
    "use server";
    if (!(await isAdmin())) redirect("/admin/login");
    const actual = await db.event.findUnique({
      where: { id },
      select: { published: true },
    });
    await db.event.update({
      where: { id },
      data: { published: !actual?.published },
    });
    revalidatePath(`/admin/evento/${id}`);
    revalidatePath("/");
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/admin/partidos" className="etiqueta text-muted hover:text-accent transition-colors">
        ← Partidos
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 mt-4 mb-8">
        <div>
          <h1 className="titulo text-4xl">{evento.title}</h1>
          <p className="mt-2 text-sm text-muted tabular-nums">
            {fechaBreve(evento.date)}
            {evento.location ? ` · ${evento.location}` : ""} ·{" "}
            {plural(evento._count.photos, "foto", "fotos")}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {evento.published && (
            <Link
              href={`/e/${evento.slug}`}
              className="etiqueta text-muted hover:text-ink transition-colors"
            >
              Ver público
            </Link>
          )}
          <form action={alternarPublicado}>
            <button
              type="submit"
              className={`etiqueta rounded-full px-5 py-2.5 border transition-colors ${
                evento.published
                  ? "border-line text-muted hover:border-danger hover:text-danger"
                  : "bg-accent-solid text-accent-ink border-accent"
              }`}
            >
              {evento.published ? "Despublicar" : "Publicar"}
            </button>
          </form>
        </div>
      </div>

      <section className="border border-line rounded-lg p-5 mb-10 grid gap-6 sm:grid-cols-2">
        <PrecioPartido
          eventId={evento.id}
          precioActual={evento.priceArs}
          escalones={escalones}
          action={guardarPrecio}
        />

        <div>
          <h2 className="etiqueta text-muted mb-1">Deporte y pack completo</h2>
          <p className="text-sm text-muted mb-4 max-w-prose">
            El deporte agrupa el partido en la portada. El precio de pack es
            opcional: si lo cargás, en el carrito se ofrece llevarse todas las
            fotos de este partido a ese precio fijo, en vez de sueltas con
            descuento por cantidad.
          </p>
          <form action={guardarDetalles} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="eventId" value={evento.id} />
            <div>
              <label htmlFor="category" className="etiqueta text-muted block mb-1.5">
                Deporte
              </label>
              <input
                id="category"
                name="category"
                defaultValue={evento.category ?? ""}
                placeholder="Fútbol"
                className="w-40 bg-surface border border-line rounded-md px-3 py-2.5 focus:border-accent outline-none"
              />
            </div>
            <div>
              <label htmlFor="packPriceArs" className="etiqueta text-muted block mb-1.5">
                Precio del pack
              </label>
              <input
                id="packPriceArs"
                name="packPriceArs"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                defaultValue={evento.packPriceArs ?? ""}
                placeholder="Sin pack"
                className="w-40 bg-surface border border-line rounded-md px-3 py-2.5 tabular-nums focus:border-accent outline-none"
              />
            </div>
            <button
              type="submit"
              className="etiqueta bg-accent-solid text-accent-ink rounded-md px-6 py-2.5 hover:opacity-90 transition-opacity"
            >
              Guardar
            </button>
          </form>
        </div>

        <div>
          <h2 className="etiqueta text-muted mb-1">Portada</h2>
          <p className="text-sm text-muted mb-4 max-w-prose">
            Es la foto que representa al partido en la página principal. Va{" "}
            <span className="text-ink">sin marca de agua</span>, para que invite a entrar,
            pero del mismo tamaño chico que una miniatura. Elegila abajo.
          </p>
          <div className="aspect-[3/2] max-w-64 bg-surface-2 rounded-md overflow-hidden border border-line">
            {evento.coverKey ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={publicUrl(evento.coverKey)}
                alt="Portada del partido"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-xs text-muted px-4 text-center">
                Sin elegir: se usa la primera foto, con marca de agua
              </div>
            )}
          </div>
        </div>
      </section>

      <Uploader eventId={evento.id} />

      {evento.photos.length > 0 && (
        <section className="mt-12">
          <h2 className="etiqueta text-muted mb-1">Últimas cargadas</h2>
          <p className="text-sm text-muted mb-4 max-w-prose">
            <span className="text-ink">Portada</span> es la foto que representa al
            partido. <span className="text-ink">Portfolio</span> la suma a la
            selección de tus mejores fotos, abajo en la página principal.{" "}
            <span className="text-ink">Tapa</span> la pone de fondo del encabezado del
            sitio, detrás del título. Las tres salen sin marca de agua y en chico.
          </p>
          <ul className="grid gap-3 grid-cols-3 sm:grid-cols-5 lg:grid-cols-6">
            {evento.photos.map((photo) => {
              const esPortada = evento.coverKey?.startsWith(`portada/${id}/${photo.id}.`);
              return (
                <li key={photo.id}>
                  <div
                    className={`aspect-[3/2] bg-surface rounded overflow-hidden border ${
                      esPortada ? "border-accent" : "border-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={publicUrl(photo.thumbKey)}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-1">
                    <span className="etiqueta text-[0.6rem] text-muted">#{photo.code}</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {esPortada ? (
                        <span className="etiqueta text-[0.6rem] text-accent">Portada</span>
                      ) : (
                        <form action={usarDePortada}>
                          <input type="hidden" name="photoId" value={photo.id} />
                          <button
                            type="submit"
                            className="etiqueta text-[0.6rem] text-muted hover:text-accent transition-colors"
                          >
                            Portada
                          </button>
                        </form>
                      )}
                      <form action={alternarPortfolio}>
                        <input type="hidden" name="photoId" value={photo.id} />
                        <button
                          type="submit"
                          className={`etiqueta text-[0.6rem] transition-colors ${
                            photo.destacada
                              ? "text-accent hover:text-danger"
                              : "text-muted hover:text-accent"
                          }`}
                        >
                          {photo.destacada ? "En portfolio ✕" : "Portfolio"}
                        </button>
                      </form>
                      <form action={usarDeTapa}>
                        <input type="hidden" name="photoId" value={photo.id} />
                        <button
                          type="submit"
                          className="etiqueta text-[0.6rem] text-muted hover:text-accent transition-colors"
                        >
                          Tapa
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
