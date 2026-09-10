import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { BotonEnvio } from "@/components/boton-envio";
import { Uploader } from "@/components/uploader";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { deleteObject, publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portfolio", robots: { index: false } };

/**
 * Cambia una foto de lugar, intercambiándola con su vecina.
 *
 * Se intercambian los dos números en vez de recalcular toda la fila: la
 * operación es una sola y no depende de que el resto esté bien numerado.
 */
async function mover(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  const hacia = String(formData.get("hacia") ?? "");

  const fotos = await db.portfolioPhoto.findMany({
    orderBy: [{ orden: "asc" }, { createdAt: "desc" }],
    select: { id: true, orden: true },
  });

  const i = fotos.findIndex((f) => f.id === id);
  const j = hacia === "antes" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= fotos.length) return;

  await db.$transaction([
    db.portfolioPhoto.update({ where: { id: fotos[i].id }, data: { orden: fotos[j].orden } }),
    db.portfolioPhoto.update({ where: { id: fotos[j].id }, data: { orden: fotos[i].orden } }),
  ]);

  revalidatePath("/admin/portfolio");
  revalidatePath("/portfolio");
  revalidatePath("/");
}

async function guardarTitulo(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!id) return;

  await db.portfolioPhoto.update({ where: { id }, data: { titulo: titulo || null } });

  revalidatePath("/admin/portfolio");
  revalidatePath("/portfolio");
  revalidatePath("/");
}

/// Saca una foto del portfolio y borra sus archivos. Acá sí se borran —a
/// diferencia de una foto de partido, que alguien puede haber comprado—: una
/// del portfolio no está en ninguna orden y sus archivos no le sirven a nadie.
async function borrar(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const id = String(formData.get("id") ?? "");
  const foto = await db.portfolioPhoto.findUnique({ where: { id } });
  if (!foto) return;

  // Primero la base, que es la decisión, y después los archivos: al revés, si
  // la base fallara, quedaría una foto en el portfolio con la imagen rota.
  await db.portfolioPhoto.delete({ where: { id } });

  await deleteObject("public", foto.key).catch(() => {});
  await deleteObject("public", foto.thumbKey).catch(() => {});
  await deleteObject("private", foto.originalKey).catch(() => {});

  revalidatePath("/admin/portfolio");
  revalidatePath("/portfolio");
  revalidatePath("/");
}

export default async function AdminPortfolioPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const fotos = await db.portfolioPhoto.findMany({
    orderBy: [{ orden: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link
        href="/admin"
        className="etiqueta text-muted hover:text-accent transition-colors inline-block mb-6"
      >
        ← Panel
      </Link>

      <h1 className="titulo text-4xl mb-1">Portfolio</h1>
      <p className="text-sm text-muted mb-10 max-w-prose">
        Tu carta de presentación: la selección que ve un organizador o una marca que entra al
        sitio. Estas fotos <strong className="text-ink">no están a la venta</strong> y se
        publican grandes y sin marca de agua, que es lo que hace que se vea tu trabajo. Se
        muestran en la portada y en la página de portfolio, en este orden.
      </p>

      <Uploader />

      <div className="mt-12">
        <h2 className="etiqueta text-muted mb-4">
          {fotos.length === 0
            ? "Todavía no subiste ninguna"
            : `${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}`}
        </h2>

        <ul className="space-y-3">
          {fotos.map((foto, i) => (
            <li
              key={foto.id}
              className="flex flex-wrap items-center gap-4 border border-line rounded-lg p-3"
            >
              <span className="etiqueta text-[0.65rem] text-muted w-6 tabular-nums shrink-0">
                {i + 1}
              </span>

              <div className="w-28 shrink-0 rounded overflow-hidden bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicUrl(foto.thumbKey)} alt="" className="w-full h-auto" />
              </div>

              <form action={guardarTitulo} className="flex-1 min-w-50 flex gap-2">
                <input type="hidden" name="id" value={foto.id} />
                <input
                  name="titulo"
                  defaultValue={foto.titulo ?? ""}
                  placeholder="Un pie, si querés (opcional)"
                  className="flex-1 bg-surface border border-line rounded-md px-3 py-2 text-sm focus:border-accent outline-none"
                />
                <BotonEnvio enviando="…" className="border border-line px-4 py-2 text-[0.65rem] text-muted con-mouse:hover:border-accent">
                  Guardar
                </BotonEnvio>
              </form>

              <div className="flex items-center gap-1 shrink-0">
                <Flecha id={foto.id} hacia="antes" desactivada={i === 0} />
                <Flecha id={foto.id} hacia="despues" desactivada={i === fotos.length - 1} />
              </div>

              <form action={borrar} className="shrink-0">
                <input type="hidden" name="id" value={foto.id} />
                <BotonEnvio enviando="Borrando…" className="text-[0.65rem] text-muted con-mouse:hover:text-danger px-2">
                  Borrar
                </BotonEnvio>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Flecha({
  id,
  hacia,
  desactivada,
}: {
  id: string;
  hacia: "antes" | "despues";
  desactivada: boolean;
}) {
  return (
    <form action={mover}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="hacia" value={hacia} />
      <button
        type="submit"
        disabled={desactivada}
        aria-label={hacia === "antes" ? "Mover antes" : "Mover después"}
        className="w-8 h-8 grid place-items-center rounded border border-line text-muted con-mouse:hover:border-accent con-mouse:hover:text-ink transition-colors disabled:opacity-30 disabled:pointer-events-none"
      >
        {hacia === "antes" ? "↑" : "↓"}
      </button>
    </form>
  );
}
