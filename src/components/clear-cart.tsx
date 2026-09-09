"use client";

import { useEffect } from "react";

import { useCart } from "./cart-context";

/// El carrito se vacía recién al llegar a una compra pagada. Si el comprador
/// abandona MercadoPago a mitad de camino, su selección sigue intacta.
export function ClearCartOnPaid() {
  const { clear, ready, count } = useCart();

  useEffect(() => {
    if (ready && count > 0) clear();
  }, [ready, count, clear]);

  return null;
}
