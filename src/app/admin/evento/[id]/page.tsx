import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { BotonEnvio } from "@/components/boton-envio";

import { PrecioPartido } from "@/components/precio-partido";
import { Uploader } from "@/components/uploader";
import { leerEscalones } from "@/lib/ajustes";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { fechaBreve, plural } from "@/lib/format";
import { guardarContenido, leerContenido } from "@/lib/contenido";
import { deleteObject, getObject, publicUrl, putObject } from "@/lib/storage";
import { TAPA_CELULAR, TAPA_ESCRITORIO } from "@/lib/encuadre";
import { renderPortada, renderTapa } from "@/lib/watermark";

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

/// La portada de un equipo, para la tarjeta del selector que aparece al entrar
/// a un partido separado. Mismo sistema que `usarDePortada`: sin marca de
/// agua, mismo tamaño chico que una miniatura. Sólo se puede elegir entre las
/// fotos de ese equipo —lo dice la foto, no el formulario— así que no hay
/// forma de ponerle a un equipo la portada del otro.
async function usarDePortadaEquipo(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const photoId = String(formData.get("photoId") ?? "");
  const foto = await db.photo.findUnique({
    where: { id: photoId },
    select: { originalKey: true, eventId: true, equipo: true },
  });
  if (!foto || !foto.equipo) return;

  const { eventId, equipo } = foto;
  const anterior = await db.equipoPortada.findUnique({
    where: { eventId_equipo: { eventId, equipo } },
    select: { coverKey: true },
  });

  const original = await getObject("private", foto.originalKey);
  const portada = await renderPortada(original);

  // Clave nueva en cada cambio, por el mismo motivo que la portada del
  // partido: las fotos públicas se publican con caché de un año.
  const coverKey = `portada/${eventId}/equipo/${photoId}.${Date.now().toString(36)}.jpg`;
  await putObject("public", coverKey, portada, "image/jpeg");

  await db.equipoPortada.upsert({
    where: { eventId_equipo: { eventId, equipo } },
    create: { eventId, equipo, coverKey },
    update: { coverKey },
  });

  if (anterior && anterior.coverKey !== coverKey) {
    await deleteObject("public", anterior.coverKey).catch(() => {});
  }

  revalidatePath(`/admin/evento/${eventId}`);
  revalidatePath("/e");
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

/// Corrige el equipo de una foto ya subida. Es la única forma de arreglar un
/// error de tipeo en el campo de la tanda: no hay borrado de fotos sueltas en
/// todo el sitio, así que sin esto un nombre mal escrito quedaría pegado para
/// siempre.
async function asignarEquipo(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const photoId = String(formData.get("photoId") ?? "");
  const equipo = String(formData.get("equipo") ?? "").trim();
  if (!photoId) return;

  const foto = await db.photo.update({
    where: { id: photoId },
    data: { equipo: equipo || null },
    select: { eventId: true },
  });

  revalidatePath(`/admin/evento/${foto.eventId}`);
  revalidatePath("/e");
}

export default async function AdminEventoPage({ params }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;

  const evento = await db.event.findUnique({
    where: { id },
    include: { _count: { select: { photos: true } } },
  });
  if (!evento) notFound();

  const escalones = await leerEscalones();

  // Los nombres de equipo que ya tiene este partido, para sugerirlos al subir
  // una tanda nueva y para elegir entre ellos al corregir una foto.
  const equiposDelPartido = (
    await db.photo.findMany({
      where: { eventId: id, equipo: { not: null } },
      distinct: ["equipo"],
      select: { equipo: true },
      orderBy: { equipo: "asc" },
    })
  ).map((p) => p.equipo!);

  // La portada que Santi eligió para cada equipo, si eligió alguna. Sin fila
  // acá, la galería pública usa de respaldo la primera foto de ese equipo, con
  // marca de agua —mismo criterio que la portada del partido sin elegir.
  const portadasPorEquipo = new Map(
    (
      await db.equipoPortada.findMany({
        where: { eventId: id },
        select: { equipo: true, coverKey: true },
      })
    ).map((p) => [p.equipo, p.coverKey]),
  );

  // Las fotos para elegir portada y corregir equipo, agrupadas por equipo y
  // sin límite: antes era una sola lista con las últimas 60 cargadas, sin
  // importar de qué equipo eran, así que subir la tanda de un equipo después
  // de la del otro enterraba a la primera tanda fuera de esa lista, sin forma
  // de verla ni de elegirle portada. Agrupando, cada equipo tiene todas las
  // suyas y subir una tanda no tapa a la anterior.
  //
  // Sin equipos en el partido, queda un solo grupo (`null`) con todas las
  // fotos del partido.
  const nombresDeGrupo: (string | null)[] =
    equiposDelPartido.length > 0 ? [...equiposDelPartido, null] : [null];
  const gruposFotos = (
    await Promise.all(
      nombresDeGrupo.map(async (equipo) => {
        const fotos = await db.photo.findMany({
          where: { eventId: id, equipo },
          orderBy: { createdAt: "desc" },
          select: { id: true, code: true, thumbKey: true, equipo: true },
        });
        return { equipo, fotos };
      }),
    )
    // El grupo "sin equipo" sólo interesa si de verdad quedó alguna sin
    // asignar: en un partido separado, lo normal es que no sobre ninguna.
  ).filter((grupo) => grupo.fotos.length > 0);

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
            <BotonEnvio
              enviando={evento.published ? "Despublicando" : "Publicando"}
              className={`rounded-full px-5 py-2.5 border inline-flex items-center ${
                evento.published
                  ? "border-line text-muted hover:border-danger hover:text-danger"
                  : "bg-accent-solid text-accent-ink border-accent"
              }`}
            >
              {evento.published ? "Despublicar" : "Publicar"}
            </BotonEnvio>
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
            <BotonEnvio
              enviando="Guardando"
              className="bg-accent-solid text-accent-ink rounded-md px-6 py-2.5 hover:opacity-90 inline-flex items-center"
            >
              Guardar
            </BotonEnvio>
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

      {/* Sólo si el partido tiene equipos separados: la portada de cada uno,
          la foto que aparece en su tarjeta al elegir equipo. Se elige igual
          que la portada del partido, desde los botones de la grilla de abajo,
          pero sólo entre las fotos de ese equipo. */}
      {equiposDelPartido.length > 0 && (
        <section className="border border-line rounded-lg p-5 mb-10">
          <h2 className="etiqueta text-muted mb-1">Portada por equipo</h2>
          <p className="text-sm text-muted mb-4 max-w-prose">
            La foto de cada tarjeta al elegir equipo, antes de entrar a la grilla. Mismo
            sistema que la portada del partido: <span className="text-ink">sin marca de
            agua</span> y del mismo tamaño chico. Elegilas abajo, entre las fotos ya
            marcadas con ese equipo.
          </p>
          <div className="flex flex-wrap gap-4">
            {equiposDelPartido.map((equipo) => {
              const coverKey = portadasPorEquipo.get(equipo);
              return (
                <div key={equipo} className="w-40">
                  <div className="aspect-[3/2] bg-surface-2 rounded-md overflow-hidden border border-line">
                    {coverKey ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={publicUrl(coverKey)}
                        alt={`Portada de ${equipo}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[0.65rem] text-muted px-3 text-center">
                        Sin elegir: se usa la primera foto, con marca de agua
                      </div>
                    )}
                  </div>
                  <p className="etiqueta text-[0.65rem] text-muted mt-1.5 truncate">{equipo}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* La usan tanto el campo de equipo del subidor como el selector de
          reasignación de abajo, para sugerir los nombres que ya existen en
          este partido en vez de que cada uno se tipee de cero. */}
      <datalist id="equipos-partido">
        {equiposDelPartido.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>

      <Uploader eventId={evento.id} />

      {gruposFotos.length > 0 && (
        <section className="mt-12">
          <h2 className="etiqueta text-muted mb-1">Fotos cargadas</h2>
          <p className="text-sm text-muted mb-4 max-w-prose">
            <span className="text-ink">Portada</span> es la foto que representa al
            partido. <span className="text-ink">Portfolio</span> la suma a la
            selección de tus mejores fotos, abajo en la página principal.{" "}
            <span className="text-ink">Tapa</span> la pone de fondo del encabezado del
            sitio, detrás del título. Las tres salen sin marca de agua y en chico.
            {gruposFotos.length > 1 &&
              " Agrupadas por equipo, para que subir la tanda de uno no tape las fotos del otro."}
          </p>
          {gruposFotos.map((grupo) => (
          <div key={grupo.equipo ?? "sin-equipo"} className="mb-8 last:mb-0">
            {gruposFotos.length > 1 && (
              <h3 className="etiqueta text-[0.7rem] text-ink mb-2">
                {grupo.equipo ?? "Sin equipo"}{" "}
                <span className="text-muted tabular-nums font-normal normal-case tracking-normal">
                  · {grupo.fotos.length === 1 ? "1 foto" : `${grupo.fotos.length} fotos`}
                </span>
              </h3>
            )}
          <ul className="grid gap-3 grid-cols-3 sm:grid-cols-5 lg:grid-cols-6">
            {grupo.fotos.map((photo) => {
              const esPortada = evento.coverKey?.startsWith(`portada/${id}/${photo.id}.`);
              const esPortadaEquipo =
                photo.equipo &&
                portadasPorEquipo
                  .get(photo.equipo)
                  ?.startsWith(`portada/${id}/equipo/${photo.id}.`);
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
                          <BotonEnvio
                            enviando="Poniendo…"
                            variante="discreto"
                            className="text-[0.6rem] text-muted hover:text-accent"
                          >
                            Portada
                          </BotonEnvio>
                        </form>
                      )}
                      {photo.equipo &&
                        (esPortadaEquipo ? (
                          <span className="etiqueta text-[0.6rem] text-accent">
                            Portada {photo.equipo}
                          </span>
                        ) : (
                          <form action={usarDePortadaEquipo}>
                            <input type="hidden" name="photoId" value={photo.id} />
                            <BotonEnvio
                              enviando="Poniendo…"
                              variante="discreto"
                              className="text-[0.6rem] text-muted hover:text-accent"
                            >
                              Portada {photo.equipo}
                            </BotonEnvio>
                          </form>
                        ))}
                      <form action={usarDeTapa}>
                        <input type="hidden" name="photoId" value={photo.id} />
                        <BotonEnvio
                          enviando="Poniendo…"
                          variante="discreto"
                          className="text-[0.6rem] text-muted hover:text-accent"
                        >
                          Tapa
                        </BotonEnvio>
                      </form>
                    </div>
                    {/* Sin texto libre a propósito: es para corregir a uno de
                        los equipos que ya existen en el partido, no para
                        inventar uno nuevo con otro tipeo distinto —eso pasa
                        por el campo de la tanda, arriba. */}
                    <form action={asignarEquipo} className="mt-1 flex items-center gap-1">
                      <input type="hidden" name="photoId" value={photo.id} />
                      {/* `key` con el valor guardado: sin esto, al guardar y
                          revalidar la página React reutiliza el mismo
                          `<select>` y no vuelve a aplicar el `defaultValue`
                          nuevo, así que el cambio se guarda pero no se ve
                          hasta recargar a mano. Con la `key`, React lo
                          desmonta y lo vuelve a montar con el valor real. */}
                      <select
                        key={photo.equipo ?? ""}
                        name="equipo"
                        defaultValue={photo.equipo ?? ""}
                        className="text-[0.6rem] bg-transparent border border-line rounded px-1 py-0.5 text-muted max-w-20"
                      >
                        <option value="">Sin equipo</option>
                        {equiposDelPartido.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                      <BotonEnvio
                        enviando="…"
                        variante="discreto"
                        className="text-[0.6rem] text-muted hover:text-accent"
                      >
                        Guardar
                      </BotonEnvio>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
          </div>
          ))}
        </section>
      )}
    </div>
  );
}
