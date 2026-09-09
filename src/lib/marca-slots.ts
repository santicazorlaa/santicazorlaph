/// Constantes puras, sin acceso a base ni a storage, para que las pueda importar
/// también el componente del panel, que corre en el navegador.

/// Los dos lugares donde se aplica la marca sobre la foto.
export const SLOTS = ["mosaico", "centro"] as const;
export type Slot = (typeof SLOTS)[number];

export const NOMBRE_SLOT: Record<Slot, string> = {
  mosaico: "Marca del mosaico",
  centro: "Marca del centro",
};

export const DESCRIPCION_SLOT: Record<Slot, string> = {
  mosaico: "Se repite en diagonal por toda la foto. Conviene el isotipo solo.",
  centro: "Va una sola vez, grande, en el medio. Conviene el logotipo con el nombre.",
};

export function esSlot(valor: string): valor is Slot {
  return (SLOTS as readonly string[]).includes(valor);
}
