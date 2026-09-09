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

En septiembre de 2026 se rediseñó: fondo oscuro con azul, tipografías Inter
Tight e Inter, grilla sin recortes (cada foto conserva su proporción) y marca de
agua con intensidad regulable desde el panel. Ese trabajo está **en la rama
`mejoras-estetica-y-marca`, sin publicar**.

Una orden pendiente **no es una alarma**: casi siempre es un checkout abandonado.
Lo grave es la que esconde un pago aprobado. Para distinguirlas:

```bash
npx tsx --conditions=react-server --env-file=.env scripts/revisar-pendientes.ts
```

## Qué falta

Primero, para cerrar lo de la rama `mejoras-estetica-y-marca`:

1. **Correr `npx prisma migrate deploy`.** Crea la tabla `Ajuste`, donde se
   guarda la intensidad de la marca de agua. Es aditiva: no toca nada de lo que
   ya está. Hasta que no se corra, los controles del panel se ven pero al
   guardar fallan (leer sí funciona: usa los valores por defecto).
2. **Mirar los controles de intensidad en el panel**, que quedaron sin revisar a
   ojo.
3. **Decidir si rehacer las previsualizaciones ya subidas.** Las 60 fotos del
   Bayern vs Drink siguen online con la calidad vieja (1100 px, calidad 82); las
   nuevas salen a 820 px y calidad 62. El script de arriba las rehace.
4. **Publicar la rama.**

Después, lo que ya venía de antes:

5. **Seis partidos "Bayern vs Drink" duplicados y vacíos** (0 fotos), de haber
   reintentado la creación. Conviene borrarlos —son inofensivos pero ensucian el
   panel— y ver por qué se crearon repetidos: puede ser que el formulario no dé
   señal de que ya se envió. Además le dejaron al partido real una dirección
   fea: `/e/bayern-vs-drink-7`.
6. **Sin manera de borrar ni editar un partido desde el panel.** Hoy sólo se
   puede crear y publicar/despublicar. Por eso los duplicados quedaron ahí, y
   por eso tampoco se puede corregir el precio de un partido ya creado.
7. **La galería arrastra 12 avisos de lint** por leer un `useRef` durante el
   render (`filtrando` en `src/components/gallery.tsx`). Es viejo, no rompe
   nada, pero conviene limpiarlo.
8. Ideas para más adelante: búsqueda por selfie, "mis compras" con cuenta,
   descuento por cantidad, aviso al jugador cuando se suben sus fotos.
