import { AvisoCargando, HuecoLinea, HuecoTarjetas } from "@/components/huecos";

/**
 * La portada mientras llega, y el respaldo de cualquier pantalla que no tenga
 * la suya propia.
 *
 * Es el encabezado con la foto grande y abajo la grilla de partidos, que es lo
 * que uno espera ver al volver al inicio.
 */
export default function Cargando() {
  return (
    <div>
      <AvisoCargando texto="Cargando" />
      <div className="hueco rounded-none min-h-[133.33vw] md:min-h-[41.67vw]" aria-hidden />
      <div className="mx-auto max-w-6xl px-5 py-16 space-y-8">
        <HuecoLinea className="w-48 h-8" />
        <HuecoTarjetas cantidad={3} />
      </div>
    </div>
  );
}
