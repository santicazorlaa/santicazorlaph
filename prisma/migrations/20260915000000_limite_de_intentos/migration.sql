-- Contador de intentos para frenar a quien prueba contraseñas o PINs a la fuerza.
CREATE TABLE IF NOT EXISTS "Intento" (
    "clave" TEXT NOT NULL,
    "cuenta" INTEGER NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intento_pkey" PRIMARY KEY ("clave")
);
