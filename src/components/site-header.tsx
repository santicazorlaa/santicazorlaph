"use client";

import Link from "next/link";

import { useCart } from "./cart-context";

export function SiteHeader() {
  const { count, ready } = useCart();

  return (
    <header className="border-b border-line sticky top-0 z-30 bg-ground/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="shrink-0 opacity-95 hover:opacity-100 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Santi Cazorla · Fotografía Deportiva"
            className="h-8 sm:h-10 w-auto"
          />
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/" className="etiqueta text-muted hover:text-ink transition-colors">
            Partidos
          </Link>
          <Link
            href="/carrito"
            className="etiqueta flex items-center gap-2 border border-line hover:border-accent rounded-full px-4 py-2 transition-colors"
          >
            Carrito
            {ready && count > 0 && (
              <span className="bg-accent text-accent-ink rounded-full min-w-5 h-5 px-1.5 grid place-items-center text-[0.7rem] font-semibold tabular-nums">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
