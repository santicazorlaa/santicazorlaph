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

**`.env` y `.env.vercel` apuntan a bases distintas, a propósito.** `.env` usa
`santicazorlaph_dev`; `.env.vercel` usa `neondb`, la real. Es el mismo proyecto
de Neon, así que no suma costo. Antes de esto las dos apuntaban a la misma base,
y trabajar en local tocaba clientes y ventas de verdad — pasó una vez, sin
consecuencias porque se notó a tiempo, pero fue la razón de separarlas.

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

**Un cambio de esquema (`prisma/schema.prisma`) se aplica dos veces, a mano.**
`npx prisma migrate dev` contra `.env` lo prueba en la base de desarrollo. Antes
de publicar, `npm run migrar:produccion` aplica el mismo historial contra la
base real, usando `.env.vercel`. Publicar código sin este segundo paso deja el
sitio funcionando contra un esquema viejo. Storage (R2) y el mail (Resend) en
cambio siguen compartidos entre local y producción: separarlos no valía la
complejidad, y lo peor que puede pasar por eso son archivos de sobra en el
bucket, que ya está aceptado como riesgo menor en otro lado de este documento.

**La estética se cambia desde `globals.css`, no pantalla por pantalla.** Los
colores, las tipografías y hasta el peso y la caja de los títulos son variables
CSS declaradas en un solo lugar. Cambiarlas ahí cambia el sitio entero y queda
coherente. Hay un banco de pruebas en `/estilo` (no se publica: en producción
esa ruta no existe) que muestra el mismo pedazo de sitio en varias direcciones
visuales, con fotos reales, para elegir mirando.

**Hay dos azules a propósito.** `--color-accent` es el claro, para textos y
bordes sobre el fondo oscuro; `--color-accent-solid` es el fuerte, para el
relleno de los botones con texto blanco encima. Ningún tono único hace bien los
dos trabajos sin perder contraste. Cambiar uno sin el otro rompe la legibilidad.

**El hover se marca con la variante `con-mouse`.** Un teléfono no tiene "pasar
el mouse por encima": lo que se revele con hover y no lleve esa variante queda
escondido para siempre en el celular. Ya pasó una vez —el botón "Agregar" de la
galería no aparecía nunca en el teléfono— y por eso existe la variante.

**La miniatura se mide por el ancho y la foto grande por el lado más largo.**
No es un descuido: la grilla le da a cada foto una columna del mismo ancho, así
que ahí igualar el ancho es lo que las deja parejas de nitidez; el lightbox, en
cambio, muestra la foto entera dentro de la pantalla, y midiendo por el ancho
una vertical se llevaba más del doble de píxeles que una horizontal para ocupar
menos lugar. Misma idea —que ninguna reciba más que otra para cómo se muestra—,
distinta forma de mostrar.

**Los escalones del descuento se configuran desde el panel** y se guardan en
`Ajuste` como `"3:14,5:20,10:31,15:37"`. Los lee el layout una sola vez y se los
pasa al carrito, porque el carrito vive en todas las pantallas. Si esa fila
falta o quedó ilegible salen los valores por defecto: el sitio nunca se queda
sin una tabla válida. Al guardar se normaliza —se ordena, se sacan repetidos y
se acota el porcentaje a 70— así lo guardado y lo usado para cobrar pasan por el
mismo filtro.

**El descuento por cantidad se calcula en un solo archivo,
`src/lib/descuentos.ts`, sin `server-only`.** Lo usa el navegador para mostrar
cuánto se ahorra y el servidor para cobrar: si fueran dos cuentas distintas, un
día no coincidirían. Lo que se cobra lo decide igual el servidor, con los
precios de la base. A MercadoPago se le manda una línea por foto, así que el
descuento se reparte entre esas líneas y la diferencia de redondeo se acomoda en
la última para que el total cierre al peso.

**Un partido con fotos vendidas no se borra.** El renglón de la orden apunta a
la foto con `onDelete: Restrict`, así que la base lo impide sola; el panel lo
chequea antes nada más que para explicarlo en vez de reventar. Alguien pagó esa
foto y su link de descarga tiene que seguir andando. Se puede despublicar.

**Al borrar un partido va primero la base y después los archivos.** Al revés, si
la base fallara, quedaría un partido con las fotos rotas. En este orden lo peor
que puede pasar es que sobren archivos en el bucket, que no molestan a nadie.

**La portada va sin marca de agua, a propósito.** Es lo que invita a entrar y
con la marca encima no invita. El riesgo se acota por tamaño: sale a 500 px y
con la misma compresión que una miniatura, o sea una sola foto chica por
partido. Agrandarla o mejorarle la calidad sería regalar una foto de verdad.

**La grilla de fotos reparte siempre desde la primera.** Cada foto va a la
columna más corta mirando sólo las anteriores, así al traer más fotos las que ya
estaban caen en el mismo lugar. Si se dejara balancear las columnas al navegador
(`columns` de CSS), cada "Cargar más" movería de lugar todo lo de arriba justo
cuando el comprador lo está mirando.

## Cosas que muerden

- **En Windows, `npm run build` falla si el dev server está corriendo**: tiene
  tomado el binario de Prisma. Hay que pararlo primero.
- Los scripts de `scripts/` necesitan `npx tsx --conditions=react-server
  --env-file=.env`. Sin `--conditions` el paquete `server-only` corta la
  ejecución.
- La dirección de aviso a MercadoPago **no puede redirigir**: no siguen
  redirecciones y el aviso se pierde en silencio.
- **Las fotos públicas se suben con caché de un año y marcadas `immutable`.** Es
  lo correcto para algo que no cambia nunca, pero significa que pisar el mismo
  archivo no sirve de nada: Cloudflare y los navegadores siguen mostrando la
  versión vieja durante meses. Ya pasó al bajar la calidad de las
  previsualizaciones. Por eso el reprocesado escribe en una dirección nueva,
  mueve la base y recién ahí borra la vieja. No hay token de Cloudflare en el
  proyecto, así que purgar el caché no es una opción.

## Comandos

```bash
npm run dev                                                    # levantar en local
npx tsx --conditions=react-server --env-file=.env scripts/revision-general.ts
```

Cuando se cambia algo del procesamiento de fotos —la intensidad de la marca, el
tamaño o la calidad de la previsualización— eso sólo se aplica a las fotos que se
suban después. Para las que ya están online:

```bash
npx tsx --conditions=react-server --env-file=.env scripts/rehacer-previsualizaciones.ts
```

Sin `--aplicar` es un ensayo y no escribe nada. Acepta `--partido=<slug>`.

`scripts/cambiar-direccion.ts` cambia la dirección de un partido. Sin argumentos
lista las actuales. La dirección vieja deja de responder en el acto, así que no
se usa con un partido ya compartido.

`scripts/resetear-ventas-de-prueba.ts` borra **todas** las órdenes, para dejar
el contador en cero antes de vender de verdad. Sirve además para desbloquear el
borrado de un partido de prueba: una foto comprada no se puede borrar, y por eso
tampoco su partido. No correrlo si ya hay ventas reales.

`revision-general.ts` verifica todo el sistema en producción de una: sitio, CDN,
que los originales no se filtren, avisos firmados y sin firmar, panel protegido,
descarga de una compra pagada, y en qué cuenta de MercadoPago está cobrando.
Hay más scripts en `scripts/`, cada uno con su explicación arriba.

`scripts/datos-de-prueba.ts` crea un partido ("CAT vs Lastenia") con 14 fotos
sintéticas generadas en el momento, para tener algo con qué probar el sitio en
la base de desarrollo. Se puede correr las veces que haga falta: primero borra
el partido anterior con ese mismo nombre, si existe.

Cuando el esquema de la base cambia (un campo nuevo, una tabla nueva), después
de publicar el código hace falta avisarle a la base real:

```bash
npm run migrar:produccion
```

## Estado

**El sitio está en producción y vendiendo.** Santi confirmó que la plata entra a
su cuenta. Funciona de punta a punta: subir fotos, marca de agua, galería,
carrito, pago, acreditación automática, descarga y mail al comprador.

Ya subió su primer partido real ("Bayern vs Drink", 60 fotos). El partido de
prueba "CAT vs Lastenia", con fotos sintéticas, quedó despublicado — no se puede
borrar porque tiene fotos vendidas en órdenes de prueba, y el esquema protege eso
a propósito.

En septiembre de 2026 se rediseñó y se publicó: fondo oscuro con azul,
tipografías Inter Tight e Inter, grilla sin recortes, visor con deslizamiento,
marca de agua e intensidad regulables, portada elegible, precio editable,
descuento por cantidad configurable y borrado de partidos.

Las ventas de prueba se borraron y el partido de prueba también, así que la base
quedó con un solo partido —el real— y el contador en cero. **Lo que entre desde
ahora es plata de verdad.**

Una orden pendiente **no es una alarma**: casi siempre es un checkout abandonado.
Lo grave es la que esconde un pago aprobado. Para distinguirlas:

```bash
npx tsx --conditions=react-server --env-file=.env scripts/revisar-pendientes.ts
```

## Qué falta

Ya está todo publicado. Lo que queda:

1. **La portada del partido quedó sin elegir.** La función está y anda; nadie la
   usó todavía, así que en la principal se sigue viendo la primera foto con
   marca de agua.
2. **Por qué se crearon seis partidos duplicados.** Ya se borraron, pero la
   causa sigue ahí: lo más probable es que el formulario de "Nuevo partido" no
   dé señal de que ya se envió y se pueda apretar dos veces.
3. **La galería arrastra 12 avisos de lint** por leer un `useRef` durante el
   render (`filtrando` en `src/components/gallery.tsx`). Es viejo, no rompe
   nada, pero conviene limpiarlo.

Sobre los descuentos, para tener presente: los porcentajes que eligió Santi
(14 / 20 / 31 / 37) salen de pensar en **precios redondos por pack**, no en
porcentajes. Con la foto a $3.500 dan packs de $9.030, $14.000, $24.150 y
$33.075. Por eso el panel muestra, al lado de cada escalón, cuánto sale el pack:
es la cifra en la que se piensa. Al cambiar el precio por foto los packs se
mueven, así que conviene pasar por el panel después.

4. Ideas para más adelante: búsqueda por selfie o por dorsal, "mis compras" con
   cuenta, aviso al jugador cuando se suben sus fotos, y la tarjeta de "pack
   completo" que quedó afuera del documento de ofertas porque depende de esos
   filtros.
