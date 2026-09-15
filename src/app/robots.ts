import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";

/**
 * Qué puede recorrer un buscador.
 *
 * Se cierran el panel, la API y las dos pantallas cuya dirección es una llave
 * (una compra y una entrega privada). El carrito y los legales **no** se
 * cierran acá aunque no deban aparecer en Google: si el robot no puede entrar,
 * tampoco lee el "no me muestres" que tienen adentro, y como ya están en
 * Google se quedarían ahí para siempre.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/compra/", "/entrega/", "/estilo"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
