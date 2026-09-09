@AGENTS.md

# santicazorlaph — venta de fotos deportivas

Sitio de Santiago Nieva Cazorla (Santi Cazorla Photography), fotógrafo deportivo
en Tucumán, para vender las fotos que saca en los partidos.

**En producción:** https://www.santicazorlaph.com · repo `santicazorlaa/santicazorlaph`

Santi no programa. Las decisiones técnicas son nuestras; él decide sobre el
negocio y sobre cómo se ve su trabajo. Prefiere que avancemos y le mostremos
resultados antes que consultarle cada detalle. **Todo se le explica en español y
sin jerga**, diciendo por qué importa cada cosa, no solo qué se hizo.

## Por qué existe

Las plataformas que usan sus colegas (Renzu, Fullfoto, Levelpic) cobran
AR$ 25.000–40.000 por mes **más** comisión, sobre un precio de mercado de
AR$ 2.500 por foto que es igual en las tres. Con infraestructura propia el costo
fijo arranca cerca de cero y sólo queda la comisión de MercadoPago.

**Al proponer cambios, cuidar que no reintroduzcan un costo fijo mensual alto.**
Es la razón de ser del proyecto. Cloudflare R2 se eligió sobre S3 justamente por
no cobrar transferencia de salida, que en un sitio de fotos es el gasto que se
dispara.

## Servicios

| Qué | Dónde | Detalle |
|---|---|---|
| Sitio | Vercel | proyecto `santicazorlaph`, rama `main` |
| Base | Neon Postgres | región São Paulo |
| Fotos | Cloudflare R2 | dos buckets, ver abajo |
| CDN de fotos | `fotos.santicazorlaph.com` | dominio propio sobre el bucket público |
| Pagos | MercadoPago | Checkout Pro, cuenta real `238509129` |
| Mails | Resend | dominio `santicazorlaph.com` verificado |
| Dominio | Cloudflare | `www` es el canónico; el apex redirige |

Las credenciales están en `.env` (local) y en las variables de Vercel. El archivo
`.env.vercel` es la copia para pegar en Vercel; ninguno de los dos va a git.

## Decisiones que conviene no revisitar sin motivo

**El original nunca llega al navegador.** Vive en el bucket privado
(`santicazorlaph-originales`) y sólo sale por URL firmada que caduca a los 5
minutos, después de que la orden está pagada. El bucket público
(`santicazorlaph-previews`) sólo tiene versiones con marca de agua.

**Una orden pasa a pagada únicamente desde el servidor**, verificando la firma
del aviso de MercadoPago y consultando el pago por su ID. Nunca desde lo que
diga el navegador al volver del checkout.

**Hay una red de seguridad además del webhook.** Si la orden figura pendiente
cuando el comprador abre su página, el sitio le pregunta a MercadoPago si hay un
pago aprobado y la acredita. Los avisos se pierden por muchas razones; esto es lo
que evita que un pago cobrado quede sin entregar.

**Los originales se suben directo al bucket desde el navegador**, en dos pasos
(autorizar → subir → procesar). Vercel rechaza cualquier petición de más de
4,5 MB y las fotos de Santi pesan ~19 MB. Esto **no** se puede simplificar a una
subida común.

**Sin cuentas de comprador.** La orden se identifica con un token secreto en la
URL, que también va por mail. Fue a propósito: una cuenta menos es un obstáculo
menos antes de pagar.

**En local se usan las credenciales de PRUEBA de MercadoPago**, aunque el sitio
publicado use las reales. Trabajar contra la cuenta real significa que un script
mal apuntado mueve plata de verdad.

**Prisma fijado en v6.** La v8 reestructuró la CLI y la ata a su plataforma.

## Cosas que muerden

- **En Windows, `npm run build` falla si el dev server está corriendo**: tiene
  tomado el binario de Prisma. Hay que pararlo primero.
- Los scripts de `scripts/` necesitan `npx tsx --conditions=react-server
  --env-file=.env`. Sin `--conditions` el paquete `server-only` corta la
  ejecución.
- La dirección de aviso a MercadoPago **no puede redirigir**: no siguen
  redirecciones y el aviso se pierde en silencio.

## Comandos

```bash
npm run dev                                                    # levantar en local
npx tsx --conditions=react-server --env-file=.env scripts/revision-general.ts
```

`revision-general.ts` verifica todo el sistema en producción de una: sitio, CDN,
que los originales no se filtren, avisos firmados y sin firmar, panel protegido,
descarga de una compra pagada, y en qué cuenta de MercadoPago está cobrando.
Hay más scripts en `scripts/`, cada uno con su explicación arriba.

## Estado

**El sitio está en producción y vendiendo.** Santi confirmó que la plata entra a
su cuenta. Funciona de punta a punta: subir fotos, marca de agua, galería,
carrito, pago, acreditación automática, descarga y mail al comprador.

Ya subió su primer partido real ("Bayern vs Drink", 60 fotos). El partido de
prueba "CAT vs Lastenia", con fotos sintéticas, quedó despublicado — no se puede
borrar porque tiene fotos vendidas en órdenes de prueba, y el esquema protege eso
a propósito.

Una orden pendiente **no es una alarma**: casi siempre es un checkout abandonado.
Lo grave es la que esconde un pago aprobado. Para distinguirlas:

```bash
npx tsx --conditions=react-server --env-file=.env scripts/revisar-pendientes.ts
```

## Qué falta

1. **Seis partidos "Bayern vs Drink" duplicados y vacíos** (0 fotos), de haber
   reintentado la creación. Conviene borrarlos —son inofensivos pero ensucian el
   panel— y ver por qué se crearon repetidos: puede ser que el formulario no dé
   señal de que ya se envió.
2. **Sin manera de borrar ni editar un partido desde el panel.** Hoy sólo se
   puede crear y publicar/despublicar. Por eso los duplicados quedaron ahí.
3. Ideas para más adelante: búsqueda por selfie, "mis compras" con cuenta,
   descuento por cantidad, aviso al jugador cuando se suben sus fotos.
