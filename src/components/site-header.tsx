"use client";

import Link from "next/link";

import { useCart } from "./cart-context";

export function SiteHeader() {
  const { count, ready } = useCart();

  return (
    <header className="border-b border-line sticky top-0 z-30 bg-ground/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-5 h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="Santi Cazorla · Fotografía Deportiva"
          className="shrink-0 opacity-95 hover:opacity-100 transition-opacity"
        >
          {/* El logotipo completo es muy apaisado (6,6:1) y no entra en un
              celular junto al carrito: ahí mostramos sólo el isotipo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isotipo.svg" alt="" className="h-7 w-auto sm:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="hidden sm:block h-10 w-auto" />
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="etiqueta text-muted hover:text-ink transition-colors">
            Partidos
          </Link>
          <Link
            href="/carrito"
            className="etiqueta flex items-center gap-2 border border-line hover:border-accent rounded-full px-3 sm:px-4 py-2 transition-colors"
          >
            Carrito
            {ready && count > 0 && (
              <span className="bg-accent-solid text-accent-ink rounded-full min-w-5 h-5 px-1.5 grid place-items-center text-[0.7rem] font-semibold tabular-nums">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
