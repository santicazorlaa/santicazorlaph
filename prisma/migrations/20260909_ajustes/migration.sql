-- Tabla de ajustes sueltos del sitio. Sólo agrega: no toca nada existente.
CREATE TABLE "Ajuste" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "Ajuste_pkey" PRIMARY KEY ("clave")
);
