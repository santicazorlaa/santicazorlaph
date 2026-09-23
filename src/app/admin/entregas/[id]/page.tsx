import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { BotonEnvio } from "@/components/boton-envio";
import { CopiarLinkEntrega } from "@/components/copiar-link-entrega";
import { SenalDeLink } from "@/components/senal-link";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { fechaBreve, plural } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { syncDeliveryPhotos } from "@/lib/deliveries";
import { driveDownloadUrl, driveThumbUrl } from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administrar entrega", robots: { index: false } };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resync?: string; guardado?: string; error?: string }>;
};

const claseCampo =
  "w-full bg-surface border border-line rounded-md px-3 py-2 focus:border-accent outline-none text-sm";

async function actualizarEntregaAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const fechaTexto = String(formData.get("date") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const driveUrl = String(formData.get("driveUrl") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  const published = formData.get("published") === "on";

  if (!id || !title || !clientName || !fechaTexto) return;

  await db.clientDelivery.update({
    where: { id },
    data: {
      title,
      clientName,
      date: new Date(`${fechaTexto}T12:00:00`),
      location: location || null,
      driveUrl,
      pin: pin || null,
      published,
    },
  });

  revalidatePath(`/admin/entregas/${id}`);
  revalidatePath("/admin/entregas");
  redirect(`/admin/entregas/${id}?guardado=1`);
}

async function sincronizarAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const res = await syncDeliveryPhotos(id);
  if (!res.success) {
    redirect(`/admin/entregas/${id}?error=${encodeURIComponent(res.error || "Error al sincronizar")}`);
  }

  revalidatePath(`/admin/entregas/${id}`);
  revalidatePath("/admin/entregas");
  redirect(`/admin/entregas/${id}?resync=${res.count}`);
}

async function usarPortadaAction(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  const coverUrl = String(formData.get("coverUrl") ?? "");
  if (!id || !coverUrl) return;

  await db.clientDelivery.update({
    where: { id },
    data: { coverUrl },
  });

  revalidatePath(`/admin/entregas/${id}`);
}

export default async function DetalleEntregaPage({ params, searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { id } = await params;
  const { resync, guardado, error } = await searchParams;

  const entrega = await db.clientDelivery.findUnique({
    where: { id },
    include: {
      photos: {
        orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }],
      },
      _count: { select: { eventos: true } },
    },
  });

  if (!entrega) notFound();

  const publicPageUrl = `${siteUrl}/entrega/${entrega.slug}`;
  const fechaIso = entrega.date.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex items-center gap-2 text-xs text-muted mb-4">
        <Link href="/admin" className="con-mouse:hover:text-ink transition-colors">
          Panel
        </Link>
        <span>/</span>
        <Link href="/admin/entregas" className="con-mouse:hover:text-ink transition-colors">
          Entregas a Equipos
        </Link>
        <span>/</span>
        <span className="text-ink">{entrega.title}</span>
      </div>

      {resync && (
        <div className="mb-6 p-4 border border-accent/40 bg-accent/10 rounded-md text-sm text-accent flex items-center justify-between">
          <span>Listo: se actualizaron {resync} fotos desde Google Drive.</span>
        </div>
      )}

      {guardado && (
        <div className="mb-6 p-4 border border-line bg-surface rounded-md text-sm text-muted">
          Listo: los datos de la entrega se guardaron.
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 border border-red-500/30 bg-red-500/10 rounded-md text-sm text-red-200">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Cabecera y acciones de compartir */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-line pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="etiqueta text-accent">{entrega.clientName}</span>
            {!entrega.published && (
              <span className="text-[0.65rem] uppercase tracking-wider bg-line px-2 py-0.5 rounded text-muted">
                Borrador
              </span>
            )}
            {entrega.pin && (
              <span className="text-[0.65rem] uppercase tracking-wider bg-accent/10 border border-accent/20 px-2 py-0.5 rounded text-accent font-mono">
                PIN: {entrega.pin}
              </span>
            )}
          </div>
          <h1 className="titulo text-3xl sm:text-4xl mb-2">{entrega.title}</h1>
          <p className="text-sm text-muted">
            {fechaBreve(entrega.date)} {entrega.location ? `· ${entrega.location}` : ""} ·{" "}
            {plural(entrega.photos.length, "foto", "fotos")} sincronizadas
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-3">
          <CopiarLinkEntrega
            url={publicPageUrl}
            titulo={entrega.title}
            equipo={entrega.clientName}
            pin={entrega.pin}
          />

          {/* La actividad va primera y como botón, no como un link más de la
              fila de abajo: es lo que Santi quiere mirar al día siguiente de
              mandar la entrega, y es lo que le dice si le llegó al equipo. */}
          <Link
            href={`/admin/entregas/${entrega.id}/actividad`}
            className="etiqueta text-[0.65rem] rounded-full border border-line bg-surface px-4 py-2 con-mouse:hover:border-accent transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.97] inline-flex items-center"
          >
            Ver actividad
            {entrega._count.eventos > 0 && (
              <span className="ml-2 text-accent tabular-nums">
                {entrega._count.eventos}
              </span>
            )}
            <SenalDeLink />
          </Link>

          <div className="flex items-center gap-3">
            <a
              href={entrega.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-ink transition-colors underline underline-offset-4"
            >
              Abrir carpeta en Google Drive ↗
            </a>
            <Link
              href={`/entrega/${entrega.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-accent hover:underline underline-offset-4"
            >
              Ver como jugador ↗
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3 mb-12">
        {/* Panel lateral de ajustes y sincronización */}
        <div className="lg:col-span-1 space-y-6">
          <div className="border border-line rounded-lg p-5 bg-surface">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-4">
              Sincronización
            </h2>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              Si agregaste o editaste fotos en la carpeta de Google Drive, tocá sincronizar para
              actualizar la galería web al instante.
            </p>

            <form action={sincronizarAction}>
              <input type="hidden" name="id" value={entrega.id} />
              <BotonEnvio
                enviando="Sincronizando fotos…"
                className="w-full text-xs bg-accent text-ground font-medium py-2 rounded hover:bg-accent/90 transition-colors"
              >
                Sincronizar con Google Drive
              </BotonEnvio>
            </form>
          </div>

          <div className="border border-line rounded-lg p-5 bg-surface">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-4">
              Datos de la entrega
            </h2>
            <form action={actualizarEntregaAction} className="space-y-4">
              <input type="hidden" name="id" value={entrega.id} />

              <div>
                <label className="block text-xs text-muted mb-1" htmlFor="title">
                  Título
                </label>
                <input id="title" name="title" defaultValue={entrega.title} required className={claseCampo} />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1" htmlFor="clientName">
                  Equipo / Club
                </label>
                <input id="clientName" name="clientName" defaultValue={entrega.clientName} required className={claseCampo} />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1" htmlFor="date">
                  Fecha
                </label>
                <input id="date" name="date" type="date" defaultValue={fechaIso} required className={claseCampo} />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1" htmlFor="location">
                  Lugar / Cancha
                </label>
                <input id="location" name="location" defaultValue={entrega.location ?? ""} className={claseCampo} />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1" htmlFor="driveUrl">
                  Carpeta de Google Drive
                </label>
                <input id="driveUrl" name="driveUrl" defaultValue={entrega.driveUrl} required className={claseCampo} />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1" htmlFor="pin">
                  PIN de acceso (opcional)
                </label>
                <input id="pin" name="pin" defaultValue={entrega.pin ?? ""} maxLength={8} className={claseCampo} />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  id="published"
                  name="published"
                  type="checkbox"
                  defaultChecked={entrega.published}
                  className="rounded border-line bg-surface text-accent focus:ring-accent"
                />
                <label htmlFor="published" className="text-xs text-ink cursor-pointer">
                  Publicada (visible para el equipo)
                </label>
              </div>

              <BotonEnvio
                enviando="Guardando cambios…"
                className="w-full text-xs bg-line/80 hover:bg-line text-ink font-medium py-2 rounded transition-colors"
              >
                Guardar cambios
              </BotonEnvio>
            </form>
          </div>
        </div>

        {/* Fotos sincronizadas */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Fotos en esta entrega ({entrega.photos.length})
            </h2>
            <p className="text-xs text-muted">
              Hacé clic en una foto para usarla de portada
            </p>
          </div>

          {entrega.photos.length === 0 ? (
            <div className="border border-dashed border-line rounded-lg p-12 text-center text-muted text-sm">
              <p className="mb-2">No hay fotos sincronizadas todavía.</p>
              <p className="text-xs text-muted max-w-sm mx-auto mb-4">
                Asegurate de que la carpeta de Google Drive sea pública (&quot;Cualquiera con el enlace puede ver&quot;)
                y tocá el botón Sincronizar.
              </p>
              <form action={sincronizarAction}>
                <input type="hidden" name="id" value={entrega.id} />
                <BotonEnvio
                  enviando="Sincronizando…"
                  className="text-xs bg-accent text-ground font-medium px-4 py-2 rounded hover:bg-accent/90"
                >
                  Sincronizar ahora
                </BotonEnvio>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {entrega.photos.map((foto) => {
                const thumb = driveThumbUrl(foto.driveFileId, "thumb");
                const preview = driveThumbUrl(foto.driveFileId, "preview");
                const esPortada = entrega.coverUrl === preview;

                return (
                  <div
                    key={foto.id}
                    className={`group relative border rounded-md overflow-hidden bg-surface transition-all ${
                      esPortada ? "ring-2 ring-accent border-transparent" : "border-line hover:border-accent/60"
                    }`}
                  >
                    <div className="aspect-[3/2] relative bg-line/20 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt={foto.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />

                      {esPortada && (
                        <span className="absolute top-2 left-2 bg-accent text-ground text-[0.65rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded shadow">
                          Portada
                        </span>
                      )}

                      <div className="absolute inset-0 bg-ground/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[0.65rem] font-mono bg-line/80 px-1.5 py-0.5 rounded text-ink">
                            #{foto.code}
                          </span>
                          <a
                            href={driveDownloadUrl(foto.driveFileId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[0.65rem] bg-accent text-ground px-2 py-1 rounded font-medium shadow hover:bg-accent/90"
                            title="Probar descarga en máxima calidad"
                          >
                            Probar descarga
                          </a>
                        </div>

                        {!esPortada && (
                          <form action={usarPortadaAction}>
                            <input type="hidden" name="id" value={entrega.id} />
                            <input type="hidden" name="coverUrl" value={preview} />
                            <button
                              type="submit"
                              className="w-full text-[0.7rem] bg-surface/90 hover:bg-surface border border-line text-ink py-1 rounded transition-colors text-center"
                            >
                              Usar como portada
                            </button>
                          </form>
                        )}
                      </div>
                    </div>

                    <div className="p-2 text-[0.7rem] text-muted truncate border-t border-line/60">
                      <span className="font-mono">{foto.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
