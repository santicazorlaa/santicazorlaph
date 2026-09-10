import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { BotonEnvio } from "@/components/boton-envio";

import { EncuadrarTapa } from "@/components/encuadrar-tapa";
import { SubirImagen } from "@/components/subir-imagen";
import { isAdmin } from "@/lib/auth";
import { CLAVES, leerContenido, type Clave } from "@/lib/contenido";
import { guardarContenido } from "@/lib/contenido";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contenido", robots: { index: false } };

/**
 * Guarda los textos de una sección.
 *
 * Una sola acción para todos los formularios de la página: cada uno manda sus
 * campos y acá se guardan los que hayan venido. Sumar un campo nuevo es sumar
 * un `<textarea>` con el nombre de su clave, sin tocar esta función.
 */
async function guardar(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const cambios: Partial<Record<Clave, string>> = {};
  for (const clave of CLAVES) {
    const valor = formData.get(clave);
    // Sólo lo que vino en este formulario. Si no está, es que esta sección no
    // lo edita, y no que quedó vacío.
    if (typeof valor === "string") cambios[clave] = valor.trim();
  }

  await guardarContenido(cambios);

  revalidatePath("/", "layout");
  redirect("/admin/contenido?guardado=1");
}

async function borrarImagen(formData: FormData) {
  "use server";
  if (!(await isAdmin())) redirect("/admin/login");

  const clave = String(formData.get("clave") ?? "") as Clave;
  if (clave !== "hero.fotoKey" && clave !== "sobre.fotoKey") redirect("/admin/contenido");

  // No se borra el archivo del bucket: sobra un archivo chico, que no molesta,
  // y a cambio nunca se rompe una imagen que hubiera quedado referenciada.
  // Sacar la tapa se lleva su recorte de celular: sin la foto de escritorio, el
  // recorte alto quedaría publicándose solo en los teléfonos.
  await guardarContenido(
    clave === "hero.fotoKey"
      ? { "hero.fotoKey": "", "hero.fotoKeyCelular": "" }
      : { [clave]: "" },
  );
  revalidatePath("/", "layout");
  redirect("/admin/contenido?guardado=1");
}

const claseCampo =
  "w-full bg-surface border border-line rounded-md px-3 py-2.5 focus:border-accent outline-none";

function Campo({
  clave,
  etiqueta,
  ayuda,
  valor,
  filas,
  placeholder,
}: {
  clave: Clave;
  etiqueta: string;
  ayuda?: string;
  valor: string;
  filas?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={clave} className="etiqueta text-muted block mb-1.5">
        {etiqueta}
      </label>
      {ayuda && <p className="text-sm text-muted mb-2 max-w-prose">{ayuda}</p>}
      {filas ? (
        <textarea
          id={clave}
          name={clave}
          rows={filas}
          defaultValue={valor}
          placeholder={placeholder}
          className={`${claseCampo} leading-relaxed`}
        />
      ) : (
        <input
          id={clave}
          name={clave}
          defaultValue={valor}
          placeholder={placeholder}
          className={claseCampo}
        />
      )}
    </div>
  );
}

function Guardar() {
  return (
    <BotonEnvio
      enviando="Guardando"
      className="bg-accent-solid text-accent-ink rounded-md px-6 py-2.5 justify-self-start hover:opacity-90 inline-flex items-center"
    >
      Guardar
    </BotonEnvio>
  );
}

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line rounded-lg p-5 sm:p-6 mb-8">
      <h2 className="titulo text-2xl mb-1">{titulo}</h2>
      <p className="text-sm text-muted mb-6 max-w-prose">{descripcion}</p>
      {children}
    </section>
  );
}

type Props = { searchParams: Promise<{ guardado?: string }> };

export default async function ContenidoPage({ searchParams }: Props) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { guardado } = await searchParams;
  const c = await leerContenido();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/admin" className="etiqueta text-muted hover:text-ink transition-colors">
        ← Panel
      </Link>

      <h1 className="titulo text-4xl mt-4 mb-2">Contenido del sitio</h1>
      <p className="text-muted mb-4 max-w-prose">
        Todo lo que se lee en la página principal se escribe acá. Lo que dejes
        vacío no aparece: la sección entera desaparece del sitio en vez de
        mostrarse a medias.
      </p>

      {guardado && <p className="text-sm text-good mb-8">Listo: ya está publicado.</p>}

      <Seccion
        titulo="Encabezado"
        descripcion="Lo primero que ve alguien que entra: la frase grande y la foto de fondo."
      >
        <form action={guardar} className="grid gap-5 mb-8">
          <Campo
            clave="hero.titular"
            etiqueta="Frase principal"
            ayuda="Corta y directa. Es el título más grande del sitio."
            valor={c["hero.titular"]}
          />
          <Campo
            clave="hero.bajada"
            etiqueta="Bajada"
            ayuda="Dos o tres renglones explicando qué se puede hacer acá."
            valor={c["hero.bajada"]}
            filas={3}
          />
          <Guardar />
        </form>

        <EncuadrarTapa
          actualEscritorio={c["hero.fotoKey"] ? publicUrl(c["hero.fotoKey"]) : null}
          actualCelular={c["hero.fotoKeyCelular"] ? publicUrl(c["hero.fotoKeyCelular"]) : null}
          hayOrigen={Boolean(c["hero.origenKey"])}
          encuadreEscritorio={c["hero.encuadreEscritorio"]}
          encuadreCelular={c["hero.encuadreCelular"]}
          titular={c["hero.titular"]}
        />
        {c["hero.fotoKey"] && (
          <form action={borrarImagen} className="mt-3">
            <input type="hidden" name="clave" value="hero.fotoKey" />
            <BotonEnvio
              enviando="Sacándola…"
              variante="discreto"
              className="text-[0.7rem] text-muted hover:text-danger"
            >
              Sacar la foto de fondo
            </BotonEnvio>
          </form>
        )}
      </Seccion>

      <Seccion
        titulo="Cómo funciona"
        descripcion="Los pasos que explican cómo se compra. Un paso por renglón, con el título y la explicación separados por una barra: Elegí tu partido|Buscá la fecha y el club."
      >
        <form action={guardar} className="grid gap-5">
          <Campo
            clave="pasos.items"
            etiqueta="Pasos"
            valor={c["pasos.items"]}
            filas={5}
            placeholder="Elegí tu partido|Buscá la fecha y el club."
          />
          <Guardar />
        </form>
      </Seccion>

      <Seccion
        titulo="Quién soy"
        descripcion="Tu historia. Es lo que separa un sitio de venta de fotos del sitio de un fotógrafo. Escribí en primera persona, como se lo contarías a alguien en la cancha. Sin texto acá, la sección no aparece."
      >
        <form action={guardar} className="grid gap-5 mb-8">
          <Campo
            clave="sobre.titulo"
            etiqueta="Título"
            valor={c["sobre.titulo"]}
            placeholder="El oficio de anticipar la jugada"
          />
          <Campo
            clave="sobre.texto"
            etiqueta="Tu historia"
            ayuda="Un renglón en blanco entre párrafo y párrafo. Por qué estás atrás de la cámara, qué buscás capturar, cuántos años hace que lo hacés."
            valor={c["sobre.texto"]}
            filas={8}
          />
          <Guardar />
        </form>

        <SubirImagen
          campo="retrato"
          etiqueta="Tu foto"
          ayuda="Una foto tuya trabajando, con la cámara en la mano. Es lo que le pone cara al sitio."
          actual={c["sobre.fotoKey"] ? publicUrl(c["sobre.fotoKey"]) : null}
          proporcion="aspect-[4/5]"
        />
        {c["sobre.fotoKey"] && (
          <form action={borrarImagen} className="mt-3">
            <input type="hidden" name="clave" value="sobre.fotoKey" />
            <BotonEnvio
              enviando="Sacándola…"
              variante="discreto"
              className="text-[0.7rem] text-muted hover:text-danger"
            >
              Sacar mi foto
            </BotonEnvio>
          </form>
        )}
      </Seccion>

      <Seccion
        titulo="Para organizadores y marcas"
        descripcion="La sección que le habla a quien organiza un torneo o a una marca, no al jugador. Es la que abre la puerta a cobrar por cubrir un evento, y no sólo por foto vendida. Sin texto acá, no aparece ni la sección ni el botón del encabezado."
      >
        <form action={guardar} className="grid gap-5">
          <Campo
            clave="servicios.titulo"
            etiqueta="Título"
            valor={c["servicios.titulo"]}
            placeholder="¿Organizás un evento?"
          />
          <Campo
            clave="servicios.texto"
            etiqueta="Texto"
            ayuda="Qué ofrecés y a quién. Un renglón en blanco entre párrafos."
            valor={c["servicios.texto"]}
            filas={5}
          />
          <Campo
            clave="servicios.items"
            etiqueta="Lista de lo que incluye"
            ayuda="Un ítem por renglón. Salen como una lista al pie de la sección."
            valor={c["servicios.items"]}
            filas={5}
            placeholder={"Cobertura completa del evento\nEntrega rápida para redes y prensa"}
          />
          <Guardar />
        </form>
      </Seccion>

      <Seccion
        titulo="Contacto y redes"
        descripcion="El WhatsApp es el más importante: apenas lo cargues aparece el botón verde flotando en todas las pantallas y los botones de 'Hablemos'. Sin número, no aparece ninguno."
      >
        <form action={guardar} className="grid gap-5">
          <Campo
            clave="contacto.whatsapp"
            etiqueta="WhatsApp"
            ayuda="Con el código de país. Podés escribirlo con espacios o guiones."
            valor={c["contacto.whatsapp"]}
            placeholder="+54 9 381 123 4567"
          />
          <Campo
            clave="contacto.mensaje"
            etiqueta="Mensaje que viene escrito"
            ayuda="Lo que aparece ya tipeado cuando alguien abre el chat. Sirve para saber de dónde viene."
            valor={c["contacto.mensaje"]}
          />
          <Campo
            clave="contacto.instagram"
            etiqueta="Instagram"
            ayuda="Tu usuario, sin el arroba."
            valor={c["contacto.instagram"]}
            placeholder="santicazorlaph"
          />
          <Campo
            clave="contacto.linkedin"
            etiqueta="LinkedIn"
            ayuda="Sólo si lo usás para el lado institucional. Podés pegar el link entero."
            valor={c["contacto.linkedin"]}
          />
          <Campo
            clave="contacto.email"
            etiqueta="Mail de contacto"
            valor={c["contacto.email"]}
          />
          <Guardar />
        </form>
      </Seccion>

      <Seccion
        titulo="Legales"
        descripcion="Los dos textos que dan seriedad institucional. Aparecen como links en el pie sólo si los escribís. Un renglón corto y sin punto final se muestra como subtítulo."
      >
        <form action={guardar} className="grid gap-5">
          <Campo
            clave="legal.terminos"
            etiqueta="Términos y condiciones"
            ayuda="Qué se vende, para qué se puede usar la foto, qué pasa si el pago falla."
            valor={c["legal.terminos"]}
            filas={10}
          />
          <Campo
            clave="legal.privacidad"
            etiqueta="Política de privacidad"
            ayuda="Qué datos se guardan del comprador (el mail) y para qué."
            valor={c["legal.privacidad"]}
            filas={10}
          />
          <Guardar />
        </form>
      </Seccion>
    </div>
  );
}
