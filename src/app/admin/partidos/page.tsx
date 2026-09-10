import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { BorrarPartido } from "@/components/borrar-partido";
import { BotonEnvio } from "@/components/boton-envio";
import { db } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import { isAdmin } from "@/lib/auth";
import { fechaBreve, plural, slugify } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partidos", robots: { index: false } };

/**
 * Borra un partido: sus fotos, sus archivos y el partido.
 *
 * Se niega si alguna foto está en una compra. No es una comodidad: alguien la
 * pagó y su link de descarga tiene que seguir andando. La base lo impide igual
 * —el renglón de la orden apunta a la foto—, pero un error de base es un
 * callejón sin salida para quien está mirando el panel, así que se chequea acá
 * y se explica.
 */
async function borrarPartido(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("eventId") ?? "");
  if (!id) redirect("/admin/partidos");

  const evento = await db.event.findUnique({
    where: { id },
    select: {
      coverKey: true,
      photos: {
        select: {
          originalKey: true,
          previewKey: true,
          thumbKey: true,
          _count: { select: { orderItems: true } },
        },
      },
    },
  });
  if (!evento) redirect("/admin/partidos?borrado=inexistente");

  const vendidas = evento.photos.filter((f) => f._count.orderItems > 0).length;
  if (vendidas > 0) redirect("/admin/partidos?borrado=vendidas");

  // Primero la base, que es la decisión, y después los archivos. Al revés, si
  // la base fallara, quedaría un partido con las fotos rotas. En este orden lo
  // peor que puede pasar es que sobren archivos en el bucket, que no molestan.
  await db.event.delete({ where: { id } });

  for (const foto of evento.photos) {
    await deleteObject("private", foto.originalKey).catch(() => {});
    await deleteObject("public", foto.previewKey).catch(() => {});
    await deleteObject("public", foto.thumbKey).catch(() => {});
  }
  if (evento.coverKey?.startsWith("portada/")) {
    await deleteObject("public", evento.coverKey).catch(() => {});
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/");
  redirect("/admin/partidos?borrado=listo");
}

const AVISOS_BORRADO: Record<string, string> = {
  listo: "Listo: el partido y sus fotos se borraron.",
  vendidas:
    "Ese partido tiene fotos vendidas, así que no se puede borrar: el link de descarga de quien las compró tiene que seguir funcionando. Se puede despublicar.",
  inexistente: "Ese partido ya no existe.",
};

async function crearEvento(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const title = String(formData.get("title") ?? "").trim();
  const fechaTexto = String(formData.get("date") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const priceArs = Number(formData.get("priceArs") ?? 2500);

  if (!title || !fechaTexto) return;

  // Si ya existe un partido con ese nombre, le pegamos un sufijo al slug.
  const base = slugify(title);
  let slug = base;
  for (let i = 2; await db.event.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const evento = await db.event.create({
    data: {
      title,
      slug,
      date: new Date(`${fechaTexto}T12:00:00`),
      location: location || null,
      category: category || null,
      priceArs: Number.isFinite(priceArs) && priceArs > 0 ? Math.round(priceArs) : 2500,
    },
  });

  redirect(`/admin/evento/${evento.id}`);
}

const claseCampo =
  "w-full bg-surface border border-line rounded-md px-3 py-2.5 focus:border-accent outline-none";

type Props = { searchParams: Promise<{ borrado?: string; nuevo?: string }> };

export default async function PartidosPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { borrado, nuevo } = await searchParams;

  const [eventos, fotosVendidas] = await Promise.all([
    db.event.findMany({
      orderBy: { date: "desc" },
      include: { _count: { select: { photos: true } } },
    }),
    // Las fotos que están en alguna compra, para no ofrecer borrar lo que no
    // se puede. Son pocas y se cuentan acá en vez de una consulta por partido.
    db.photo.findMany({ where: { orderItems: { some: {} } }, select: { eventId: true } }),
  ]);

  const vendidasPorPartido = new Map<string, number>();
  for (const foto of fotosVendidas) {
    vendidasPorPartido.set(foto.eventId, (vendidasPorPartido.get(foto.eventId) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link
        href="/admin"
        className="etiqueta text-muted hover:text-accent transition-colors inline-block mb-6"
      >
        ← Panel
      </Link>

      <h1 className="titulo text-4xl mb-10">Partidos</h1>

      {/* Abierto de entrada cuando se llega con "Nuevo partido", cerrado cuando
          se viene a mirar la lista: son dos intenciones distintas y el panel no
          tiene por qué adivinar. */}
      <details
        open={nuevo === "1" || eventos.length === 0}
        className="border border-line rounded-lg mb-10 group"
      >
        <summary className="etiqueta text-muted px-5 py-4 cursor-pointer list-none flex items-center justify-between con-mouse:hover:text-fg transition-colors">
          Nuevo partido
          <span className="text-lg leading-none transition-transform duration-200 ease-out group-open:rotate-45">
            +
          </span>
        </summary>

        <form action={crearEvento} className="grid gap-4 sm:grid-cols-2 px-5 pb-5">
          <div className="sm:col-span-2">
            <label htmlFor="title" className="etiqueta text-muted block mb-1.5">
              Nombre
            </label>
            <input id="title" name="title" required placeholder="CAT vs Lastenia" className={claseCampo} />
          </div>
          <div>
            <label htmlFor="date" className="etiqueta text-muted block mb-1.5">
              Fecha
            </label>
            <input id="date" name="date" type="date" required className={claseCampo} />
          </div>
          <div>
            <label htmlFor="location" className="etiqueta text-muted block mb-1.5">
              Lugar
            </label>
            <input
              id="location"
              name="location"
              placeholder="San Miguel de Tucumán"
              className={claseCampo}
            />
          </div>
          <div>
            <label htmlFor="category" className="etiqueta text-muted block mb-1.5">
              Deporte
            </label>
            <input id="category" name="category" list="deportes" placeholder="Fútbol" className={claseCampo} />
            <datalist id="deportes">
              <option value="Fútbol" />
              <option value="Básquet" />
              <option value="Vóley" />
              <option value="Rugby" />
              <option value="Hockey" />
              <option value="Maratón" />
            </datalist>
          </div>
          <div>
            <label htmlFor="priceArs" className="etiqueta text-muted block mb-1.5">
              Precio por foto
            </label>
            <input
              id="priceArs"
              name="priceArs"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              defaultValue={2500}
              className={`${claseCampo} tabular-nums`}
            />
          </div>
          <div className="flex items-end">
            <BotonEnvio
              enviando="Creando…"
              className="w-full bg-accent-solid text-accent-ink py-2.5"
            >
              Crear partido
            </BotonEnvio>
          </div>
        </form>
      </details>

      {borrado && (
        <p className={`text-sm mb-4 ${borrado === "listo" ? "text-good" : "text-danger"}`}>
          {AVISOS_BORRADO[borrado] ?? null}
        </p>
      )}

      {eventos.length === 0 ? (
        <p className="text-muted border border-dashed border-line rounded-lg py-12 text-center">
          Todavía no cargaste ningún partido.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {eventos.map((evento) => (
            <li key={evento.id} className="flex items-center gap-4 py-4">
              <Link
                href={`/admin/evento/${evento.id}`}
                className="flex flex-wrap items-baseline gap-x-5 gap-y-1 flex-1 min-w-0 hover:text-accent transition-colors"
              >
                <span className="titulo text-xl flex-1 min-w-50">{evento.title}</span>
                {evento.category && (
                  <span className="etiqueta text-[0.65rem] text-muted">{evento.category}</span>
                )}
                <span className="text-sm text-muted tabular-nums">{fechaBreve(evento.date)}</span>
                <span className="text-sm text-muted tabular-nums w-20 text-right">
                  {plural(evento._count.photos, "foto", "fotos")}
                </span>
                <span
                  className={`etiqueta text-[0.65rem] w-24 text-right ${
                    evento.published ? "text-good" : "text-muted"
                  }`}
                >
                  {evento.published ? "Publicado" : "Borrador"}
                </span>
              </Link>
              <div className="shrink-0 w-32 text-right">
                <BorrarPartido
                  eventId={evento.id}
                  titulo={evento.title}
                  cantidadFotos={evento._count.photos}
                  vendidas={vendidasPorPartido.get(evento.id) ?? 0}
                  action={borrarPartido}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
