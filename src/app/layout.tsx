import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";

import { CartProvider } from "@/components/cart-context";
import { leerEscalones } from "@/lib/ajustes";
import { AtajoAdmin } from "@/components/atajo-admin";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsappFlotante } from "@/components/whatsapp-flotante";
import { leerContenido, linkWhatsapp } from "@/lib/contenido";
import { siteName, siteUrl } from "@/lib/env";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

/// La versión angosta de Inter. Se usa en títulos y en cifras: aprieta las
/// letras sin deformarlas, así un marcador o un precio ocupan poco y se leen
/// como parte de la marca y no como texto de sistema.
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — Fotos de partidos`,
    template: `%s · ${siteName}`,
  },
  description:
    "Fotografía deportiva. Encontrá las fotos de tu partido y llevátelas en alta resolución, sin marca de agua.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Se leen acá, una sola vez, porque el carrito y el pie viven en todas las
  // pantallas.
  const [escalones, contenido] = await Promise.all([leerEscalones(), leerContenido()]);
  const whatsapp = linkWhatsapp(contenido["contacto.whatsapp"], contenido["contacto.mensaje"]);

  return (
    <html lang="es" className={`${inter.variable} ${interTight.variable}`}>
      <body className="min-h-dvh flex flex-col">
        {/* Las secciones que aparecen al scrollear arrancan invisibles y las
            revela el JavaScript. Sin JavaScript no habría quien las revele, así
            que se muestran de una: el sitio se lee igual, sin la animación.
            Va dentro del body y no suelto en el html, que no admite hijos
            fuera de head y body y rompía la hidratación. */}
        <noscript>
          <style>{`.aparece, .palabra-entrante { opacity: 1 !important; transform: none !important; filter: none !important; }`}</style>
        </noscript>
        <CartProvider escalones={escalones}>
          <AtajoAdmin />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter contenido={contenido} />
          {whatsapp && <WhatsappFlotante href={whatsapp} />}
        </CartProvider>
      </body>
    </html>
  );
}
