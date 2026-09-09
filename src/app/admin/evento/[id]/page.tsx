import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { Uploader } from "@/components/uploader";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { fechaBreve, plural, precio } from "@/lib/format";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar partido", robots: { index: false } };

type Props = { params: Promise<{ id: string }> };

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
        select: { id: true, code: true, thumbKey: true },
      },
    },
  });
  if (!evento) notFound();

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
      <Link href="/admin" className="etiqueta text-muted hover:text-ink transition-colors">
        ← Panel
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4 mt-4 mb-8">
        <div>
          <h1 className="titulo text-4xl">{evento.title}</h1>
          <p className="mt-2 text-sm text-muted tabular-nums">
            {fechaBreve(evento.date)}
            {evento.location ? ` · ${evento.location}` : ""} ·{" "}
            {precio(evento.priceArs)} por foto ·{" "}
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
                  : "bg-accent text-accent-ink border-accent"
              }`}
            >
              {evento.published ? "Despublicar" : "Publicar"}
            </button>
          </form>
        </div>
      </div>

      <Uploader eventId={evento.id} />

      {evento.photos.length > 0 && (
        <section className="mt-12">
          <h2 className="etiqueta text-muted mb-4">Últimas cargadas</h2>
          <ul className="grid gap-3 grid-cols-3 sm:grid-cols-5 lg:grid-cols-6">
            {evento.photos.map((photo) => (
              <li key={photo.id}>
                <div className="aspect-[3/2] bg-surface rounded overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrl(photo.thumbKey)}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="etiqueta text-[0.6rem] text-muted mt-1 block">
                  #{photo.code}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
