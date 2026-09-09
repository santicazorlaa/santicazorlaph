import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";

import { CartProvider } from "@/components/cart-context";
import { SiteHeader } from "@/components/site-header";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${interTight.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <CartProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line mt-24">
            <div className="mx-auto max-w-6xl px-5 py-8 flex flex-wrap gap-4 justify-between items-center text-sm text-muted">
              <span>
                © {new Date().getFullYear()} {siteName}
              </span>
              <span className="etiqueta">Tucumán, Argentina</span>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
