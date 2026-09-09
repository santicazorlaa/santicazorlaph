import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Direcciones desde las que se puede abrir el servidor de desarrollo además
   * de `localhost`.
   *
   * Sin esto, entrar desde el celular por la IP de la red local deja una página
   * que se ve bien pero está muerta: Next bloquea los archivos de desarrollo
   * cuando el pedido viene de otra dirección, así que el JavaScript nunca carga
   * y no anda ni tocar una foto ni agregarla al carrito. Engaña, porque el
   * sitio se dibuja entero.
   *
   * Sólo afecta a `npm run dev`. En producción esta restricción no existe.
   *
   * Si tu IP en la red cambia, agregala acá o pasala en `DEV_ORIGENES`
   * separadas por coma.
   */
  allowedDevOrigins: [
    "192.168.1.6",
    ...(process.env.DEV_ORIGENES?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
  ],
};

export default nextConfig;
