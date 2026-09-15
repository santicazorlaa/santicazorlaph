import "server-only";

import type { Contenido } from "./contenido";
import { linkInstagram, linkLinkedin } from "./contenido";
import { siteName, siteUrl } from "./env";

/**
 * Lo que el sitio le cuenta a Google sobre sí mismo, además de lo que se ve.
 *
 * Los "datos estructurados" son un bloque invisible que dice, en un idioma que
 * los buscadores entienden: "este sitio se llama Santi Cazorla Photography, es
 * un servicio de fotografía de Tucumán, este es su logo y su Instagram". Sin
 * eso Google adivina, y adivinaba mal: ponía "santicazorlaph.com" como nombre
 * del sitio.
 */

/// Convierte los datos a texto para meterlos en la página. Se reemplaza `<`
/// porque un título que dijera `</script>` cortaría el bloque, y lo que viniera
/// después se ejecutaría como código. Es la recomendación de Next para esto.
export function jsonLd(datos: unknown) {
  return { __html: JSON.stringify(datos).replace(/</g, "\\u003c") };
}

export const urlAbsoluta = (ruta: string) => new URL(ruta, siteUrl).toString();

/// Lo común de la vista previa al compartir un link (WhatsApp, Instagram,
/// Facebook). Next no mezcla esto entre el layout y cada página —la página lo
/// reemplaza entero—, así que cada una lo esparce y le suma lo suyo.
export const grafoBase = {
  siteName,
  locale: "es_AR",
  type: "website",
} as const;

export function datosDelSitio(c: Contenido, imagen: string | null) {
  const redes = [linkInstagram(c["contacto.instagram"]), linkLinkedin(c["contacto.linkedin"])].filter(
    (r): r is string => Boolean(r),
  );
  const telefono = c["contacto.whatsapp"].replace(/[^\d+]/g, "");
  const email = c["contacto.email"].trim();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        // Es de donde Google saca el nombre que aparece arriba del resultado.
        "@type": "WebSite",
        "@id": urlAbsoluta("/#sitio"),
        name: siteName,
        alternateName: ["Santi Cazorla", "santicazorlaph"],
        url: urlAbsoluta("/"),
        inLanguage: "es-AR",
        publisher: { "@id": urlAbsoluta("/#negocio") },
      },
      {
        "@type": "ProfessionalService",
        "@id": urlAbsoluta("/#negocio"),
        name: siteName,
        description: c["seo.descripcion"],
        url: urlAbsoluta("/"),
        logo: urlAbsoluta("/icon.png"),
        image: imagen ?? urlAbsoluta("/icon.png"),
        ...(email ? { email } : {}),
        ...(telefono ? { telephone: telefono } : {}),
        ...(redes.length ? { sameAs: redes } : {}),
        areaServed: { "@type": "AdministrativeArea", name: "Tucumán, Argentina" },
        address: { "@type": "PostalAddress", addressRegion: "Tucumán", addressCountry: "AR" },
        knowsAbout: ["Fotografía deportiva", "Fotos de partidos", "Cobertura de eventos deportivos"],
      },
    ],
  };
}

/// La miga de pan: le dice a Google que un partido cuelga de la portada, así
/// puede mostrar el camino con nombres en vez de la dirección cruda.
export function migaDePan(pasos: { nombre: string; ruta: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ nombre: "Inicio", ruta: "/" }, ...pasos].map((paso, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: paso.nombre,
      item: urlAbsoluta(paso.ruta),
    })),
  };
}
