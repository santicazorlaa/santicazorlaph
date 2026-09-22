/**
 * Qué se registra de una entrega y cómo se le avisa al sitio.
 *
 * Vive acá, compartido y **sin `server-only`**, por lo mismo que los descuentos
 * y el encuadre: la lista de qué cosas se registran la usan el navegador —para
 * avisar— y el servidor —para aceptar el aviso y para escribir la pantalla del
 * panel—. Si fueran dos listas, un día el navegador mandaría algo que el
 * servidor no reconoce y ese aviso se perdería en silencio.
 *
 * **Nada de esto identifica a nadie.** El visitante es un número al azar que
 * cada navegador se guarda a sí mismo; no hay IP, ni nombre, ni mail. Sirve
 * para contar personas en vez de clics, que es la diferencia entre "entraron
 * ocho" y "hubo ochenta visitas".
 */

/// Lo que se puede registrar, y cómo se lee cada cosa en el panel.
///
/// `drive` dice "abrió" y no "entró" a propósito: lo que pasa del otro lado del
/// botón no lo podemos ver. Google Drive no nos cuenta quién abre la carpeta ni
/// qué baja desde ahí, así que prometer eso sería mentir en el panel.
export const EVENTOS = {
  acceso: "Entró a la galería",
  vio: "Miró una foto",
  redes: "Descargó para redes",
  original: "Descargó en máxima calidad",
  drive: "Abrió la carpeta de Drive",
} as const;

export type TipoDeEvento = keyof typeof EVENTOS;

export const TIPOS_DE_EVENTO = Object.keys(EVENTOS) as TipoDeEvento[];

export function esTipoDeEvento(valor: unknown): valor is TipoDeEvento {
  return typeof valor === "string" && (TIPOS_DE_EVENTO as string[]).includes(valor);
}

/// Dónde guarda cada navegador su número de visitante.
const CLAVE_VISITANTE = "sc_visita";

/// Cómo tiene que verse un número de visitante para que el servidor lo acepte.
export const FORMA_DE_VISITANTE = /^[a-z0-9-]{8,64}$/i;

/// El número al azar de este navegador, para poder contar personas en vez de
/// clics.
///
/// Lo arma y lo guarda el navegador, no el servidor con una cookie, y no es un
/// detalle: los avisos salen con `sendBeacon`, que es "mandá y olvidate". Con
/// una cookie que naciera en la primera respuesta, entrar y tocar una foto
/// enseguida mandaba dos avisos antes de que llegara, el servidor inventaba dos
/// números y **la misma persona aparecía dos veces**. Justo el número que la
/// pantalla existe para mostrar.
///
/// Que lo arme el navegador significa que se puede falsear, y está bien: para
/// entrar hay que tener el PIN igual, y de este número no cuelga ningún
/// permiso. Sirve para contar, no para dejar entrar.
let enMemoria = "";
export function visitanteDeEsteNavegador(): string {
  if (typeof window === "undefined") return "";
  try {
    const guardado = localStorage.getItem(CLAVE_VISITANTE);
    if (guardado && FORMA_DE_VISITANTE.test(guardado)) return guardado;
    const nuevo = crypto.randomUUID();
    localStorage.setItem(CLAVE_VISITANTE, nuevo);
    return nuevo;
  } catch {
    // Sin almacén —ventana privada, datos bloqueados— alcanza con uno que dure
    // lo que dure la página: así esa persona sigue contando como una sola y no
    // como una distinta por cada cosa que hace.
    if (!enMemoria) enMemoria = crypto.randomUUID();
    return enMemoria;
  }
}

/// Cómo se nombra a un visitante en el panel: los primeros caracteres de su
/// número, nada más. Alcanza para seguir a una persona a lo largo de una tarde
/// —"éste miró veinte fotos y bajó tres"— sin saber ni poder saber quién es.
export function nombreDeVisitante(visitante: string) {
  return visitante.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "????";
}

/// Avisa que pasó algo, sin hacer esperar a nadie.
///
/// Va con `sendBeacon`, que es el camino pensado justo para esto: el navegador
/// se encarga de mandarlo por su cuenta y **sigue mandándolo aunque la pestaña
/// se cierre en el mismo momento**. Con un `fetch` común, el aviso de "bajó la
/// foto en máxima calidad" se perdería la mitad de las veces, porque ese clic
/// abre otra pestaña y se lleva la atención.
///
/// Si falla, no pasa nada: esto es una anotación, no una parte del trabajo.
/// Nunca puede romper ni demorar una descarga.
export function avisarActividad(
  slug: string,
  tipo: TipoDeEvento,
  photoId?: string,
) {
  if (typeof window === "undefined") return;
  try {
    const cuerpo = JSON.stringify({
      tipo,
      photoId,
      visitante: visitanteDeEsteNavegador(),
    });
    const url = `/api/entrega/${encodeURIComponent(slug)}/evento`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([cuerpo], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      body: cuerpo,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Que no se pueda anotar no es motivo para que algo deje de andar.
  }
}

/// Lo mismo, pero una sola vez por visita.
///
/// Sirve para lo que se repite sin aportar: entrar a la galería se cuenta una
/// vez aunque alguien recargue diez veces, y mirar la misma foto no suma un
/// renglón cada vez que se vuelve a ella. Sin esto, el panel se llenaría de
/// ruido y la pregunta "qué fotos gustaron" dejaría de tener respuesta.
///
/// Se apoya en el almacén de la pestaña, que se vacía al cerrarla: volver
/// mañana vuelve a contar, y está bien, porque es otra visita.
export function avisarUnaVez(slug: string, tipo: TipoDeEvento, photoId?: string) {
  if (typeof window === "undefined") return;
  const marca = `sc_ev:${slug}:${tipo}:${photoId ?? ""}`;
  try {
    if (sessionStorage.getItem(marca)) return;
    sessionStorage.setItem(marca, "1");
  } catch {
    // Sin almacén —ventana privada, datos bloqueados— se avisa igual. Contar de
    // más es mejor que no contar.
  }
  avisarActividad(slug, tipo, photoId);
}
