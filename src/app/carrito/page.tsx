import type { Metadata } from "next";

import { CartView } from "@/components/cart-view";

export const metadata: Metadata = { title: "Carrito" };

export default function CarritoPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="titulo text-4xl sm:text-5xl mb-8">Tu carrito</h1>
      <CartView />
    </div>
  );
}
