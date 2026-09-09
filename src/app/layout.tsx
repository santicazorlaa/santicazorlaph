import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";

import { CartProvider } from "@/components/cart-context";
import { SiteHeader } from "@/components/site-header";
import { siteName, siteUrl } from "@/lib/env";

import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
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
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable}`}>
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
