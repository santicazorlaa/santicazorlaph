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

  /// Sin el cartel "X-Powered-By: Next.js": no le sirve a ningún visitante y
  /// le ahorra a quien busca sitios vulnerables saber qué hay adentro.
  poweredByHeader: false,

  /**
   * Instrucciones de seguridad que el sitio le da al navegador en cada página.
   *
   * - `frame-ancestors 'none'` y `X-Frame-Options`: nadie puede meter el sitio
   *   adentro de otra página. Es la defensa contra el "clickjacking": un sitio
   *   trampa que pone el panel invisible encima de un botón inocente.
   * - `nosniff`: el navegador no adivina qué es un archivo; si dice imagen, es
   *   imagen y no se ejecuta como código.
   * - `Referrer-Policy`: al salir hacia otro sitio sólo se cuenta "vengo de
   *   santicazorlaph.com", nunca la dirección completa. Importa porque la
   *   dirección de una compra es la llave para descargar las fotos.
   * - `Permissions-Policy`: el sitio no usa cámara, micrófono ni ubicación, así
   *   que ni un script colado podría pedirlos.
   * - `object-src`, `base-uri` y `form-action`: cierran tres trucos clásicos de
   *   inyección (plugins viejos, cambiar la base de los links, formularios que
   *   mandan datos a otro lado).
   *
   * No hay una política de scripts completa (`script-src`) a propósito: exige
   * firmar cada script de Next en cada pedido y un error ahí deja el sitio en
   * blanco, incluido el checkout. Con estas reglas se cubre lo que más rinde sin
   * ese riesgo.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        // Las dos pantallas cuya dirección es una llave: ni el origen se cuenta.
        source: "/(compra|entrega)/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
