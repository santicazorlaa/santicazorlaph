import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { BotonEnvio } from "@/components/boton-envio";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { fechaBreve, plural } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entregas a Equipos", robots: { index: false } };

async function borrarEntrega(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("deliveryId") ?? "");
  if (!id) redirect("/admin/entregas");

  await db.clientDelivery.delete({ where: { id } });

  revalidatePath("/admin/entregas");
  revalidatePath("/admin");
  redirect("/admin/entregas?borrado=listo");
}

type Props = { searchParams: Promise<{ borrado?: string }> };

export default async function EntregasPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { borrado } = await searchParams;

  const entregas = await db.clientDelivery.findMany({
    orderBy: { date: "desc" },
    include: {
      _count: { select: { photos: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex items-center gap-2 text-xs text-muted mb-4">
        <Link href="/admin" className="con-mouse:hover:text-ink transition-colors">
          Panel
        </Link>
        <span>/</span>
        <span className="text-ink">Entregas a Equipos</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="titulo text-4xl mb-1">Entregas a Equipos</h1>
          <p className="text-sm text-muted">
            Galerías privadas vinculadas a Google Drive con descarga individual en alta calidad.
          </p>
        </div>

        <Link
          href="/admin/entregas/nueva"
          className="bg-accent text-ground font-medium text-sm px-4 py-2.5 rounded-md hover:bg-accent/90 transition-colors inline-flex items-center gap-1.5"
        >
          + Nueva entrega
        </Link>
      </div>

      {borrado === "listo" && (
        <div className="mb-6 border border-line bg-surface p-4 rounded-md text-sm text-muted flex items-center justify-between">
          <span>La entrega se eliminó correctamente.</span>
        </div>
      )}

      {entregas.length === 0 ? (
        <div className="border border-line rounded-lg p-10 text-center bg-surface/50">
          <p className="text-lg font-medium mb-2">Todavía no tenés entregas creadas</p>
          <p className="text-sm text-muted max-w-md mx-auto mb-6">
            Creá una galería privada para un club o equipo pegando el enlace de tu carpeta de Google Drive.
            Tus 5 TB se aprovechan para los originales y el equipo disfruta de una galería web rápida.
          </p>
          <Link
            href="/admin/entregas/nueva"
            className="inline-block bg-accent text-ground text-sm px-4 py-2 rounded-md font-medium"
          >
            Crear primera entrega
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-line border border-line rounded-lg overflow-hidden bg-surface">
          {entregas.map((entrega) => (
            <div
              key={entrega.id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 con-mouse:hover:bg-line/20 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="etiqueta text-accent text-xs">{entrega.clientName}</span>
                  {!entrega.published && (
                    <span className="text-[0.65rem] uppercase tracking-wider bg-line px-2 py-0.5 rounded text-muted">
                      Borrador
                    </span>
                  )}
                  {entrega.pin && (
                    <span className="text-[0.65rem] uppercase tracking-wider bg-accent/10 border border-accent/20 px-2 py-0.5 rounded text-accent">
                      PIN: {entrega.pin}
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-medium">
                  <Link
                    href={`/admin/entregas/${entrega.id}`}
                    className="hover:underline focus-visible:underline"
                  >
                    {entrega.title}
                  </Link>
                </h2>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted tabular-nums">
                  <span>{fechaBreve(entrega.date)}</span>
                  {entrega.location && <span>{entrega.location}</span>}
                  <span>{plural(entrega._count.photos, "foto", "fotos")}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                <Link
                  href={`/entrega/${entrega.slug}`}
                  target="_blank"
                  className="text-xs border border-line rounded px-3 py-1.5 text-muted hover:text-ink hover:border-accent transition-colors inline-flex items-center gap-1"
                >
                  Ver galería ↗
                </Link>

                <Link
                  href={`/admin/entregas/${entrega.id}`}
                  className="text-xs bg-line/60 hover:bg-line rounded px-3 py-1.5 font-medium transition-colors"
                >
                  Administrar
                </Link>

                <form action={borrarEntrega}>
                  <input type="hidden" name="deliveryId" value={entrega.id} />
                  <BotonEnvio
                    enviando="Borrando…"
                    variante="discreto"
                    className="text-xs text-muted hover:text-red-400 p-1.5 transition-colors"
                  >
                    Borrar
                  </BotonEnvio>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
