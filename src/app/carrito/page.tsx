import type { Metadata } from "next";

import { CartView } from "@/components/cart-view";

/// Fuera de Google: un carrito vacío no le sirve a nadie que busca, y aparecía
/// entre los primeros resultados del sitio. `follow` sigue permitido para que
/// el robot llegue igual a lo que se enlaza desde acá.
export const metadata: Metadata = { title: "Carrito", robots: { index: false, follow: true } };

export default function CarritoPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="titulo text-4xl sm:text-5xl mb-8">Tu carrito</h1>
      <CartView />
    </div>
  );
}
