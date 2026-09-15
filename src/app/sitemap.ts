import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { publicUrl } from "@/lib/storage";

/// Se arma en cada pedido: un partido nuevo tiene que figurar el mismo día, no
/// recién en la próxima publicación del sitio. Google lo pide pocas veces, así
/// que no cuesta nada.
export const dynamic = "force-dynamic";

/**
 * La lista de páginas que queremos en Google, con la fecha de su último
 * cambio. Es la forma de avisarle que hay un partido nuevo sin esperar a que
 * lo descubra solo.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [eventos, ultimaPortfolio] = await Promise.all([
    db.event.findMany({
      where: { published: true },
      orderBy: { date: "desc" },
      select: {
        slug: true,
        coverKey: true,
        createdAt: true,
        photos: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    db.portfolioPhoto.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const cambioDe = (e: (typeof eventos)[number]) => e.photos[0]?.createdAt ?? e.createdAt;
  const ultimoPartido = eventos.map(cambioDe).sort((a, b) => b.getTime() - a.getTime())[0];

  return [
    {
      url: `${siteUrl}/`,
      lastModified: ultimoPartido ?? new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/portfolio`,
      lastModified: ultimaPortfolio?.createdAt ?? new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...eventos.map((evento) => ({
      url: `${siteUrl}/e/${evento.slug}`,
      lastModified: cambioDe(evento),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      ...(evento.coverKey ? { images: [publicUrl(evento.coverKey)] } : {}),
    })),
  ];
}
