import type { Metadata } from "next";
import Link from "next/link";

import { GrillaPortfolio } from "@/components/grilla-portfolio";
import { SenalDeLink } from "@/components/senal-link";
import { leerContenido, linkWhatsapp } from "@/lib/contenido";
import { db } from "@/lib/db";
import { grafoBase } from "@/lib/seo";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

const DESCRIPCION =
  "Portfolio de Santi Cazorla, fotógrafo deportivo en Tucumán: una selección elegida a mano de fotos de partidos y eventos deportivos.";

export async function generateMetadata(): Promise<Metadata> {
  // La primera foto del portfolio es la vista previa al compartir el link: es
  // la carta de presentación, así que tiene que ser una foto de verdad.
  const primera = await db.portfolioPhoto.findFirst({
    orderBy: [{ orden: "asc" }, { createdAt: "desc" }],
    select: { thumbKey: true, width: true, height: true, titulo: true },
  });
  return {
    title: "Portfolio de fotografía deportiva",
    description: DESCRIPCION,
    alternates: { canonical: "/portfolio" },
    openGraph: {
      ...grafoBase,
      url: "/portfolio",
      title: "Portfolio de fotografía deportiva",
      description: DESCRIPCION,
      ...(primera ? { images: [{ url: publicUrl(primera.thumbKey), alt: primera.titulo ?? "" }] } : {}),
    },
  };
}

/**
 * El portfolio completo.
 *
 * Es la única parte del sitio donde las fotos se ven grandes y sin marca de
 * agua, porque es la única que no vende nada: su trabajo es mostrarle el nivel
 * a un organizador o a una marca, y para eso la foto tiene que verse.
 */
export default async function PortfolioPage() {
  const [fotos, contenido] = await Promise.all([
    db.portfolioPhoto.findMany({
      orderBy: [{ orden: "asc" }, { createdAt: "desc" }],
      select: { id: true, key: true, thumbKey: true, width: true, height: true, titulo: true },
    }),
    leerContenido(),
  ]);

  const whatsapp = linkWhatsapp(contenido["contacto.whatsapp"], contenido["contacto.mensaje"]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <Link
        href="/"
        className="etiqueta text-muted hover:text-accent transition-colors inline-flex items-center"
      >
        ← Volver
        <SenalDeLink />
      </Link>

      <h1 className="titulo text-4xl sm:text-6xl mt-6 mb-3">Lo mejor de mi trabajo</h1>
      <p className="text-muted max-w-xl mb-12">
        Una selección elegida a mano entre todo lo que cubrí. Tocá cualquier foto para verla
        en grande.
      </p>

      {fotos.length === 0 ? (
        <p className="text-muted py-20 text-center border border-dashed border-line rounded-lg">
          Todavía no hay fotos en el portfolio.
        </p>
      ) : (
        <GrillaPortfolio
          fotos={fotos.map((foto) => ({
            id: foto.id,
            url: publicUrl(foto.thumbKey),
            urlGrande: publicUrl(foto.key),
            ancho: foto.width,
            alto: foto.height,
            titulo: foto.titulo ?? "",
          }))}
        />
      )}

      {whatsapp && (
        <section className="py-20 mt-10 border-t border-line text-center">
          <h2 className="titulo text-3xl sm:text-4xl text-balance max-w-2xl mx-auto">
            ¿Querés algo así para tu evento?
          </h2>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="etiqueta bg-accent-solid text-accent-ink rounded-full px-7 py-4 inline-block mt-6 con-mouse:hover:opacity-90 active:scale-[0.97] transition-[opacity,transform] duration-150 ease-out"
          >
            Hablemos por WhatsApp
          </a>
        </section>
      )}
    </div>
  );
}
