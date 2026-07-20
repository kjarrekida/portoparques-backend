-- CreateTable
CREATE TABLE "Solicitud" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipoServicio" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nombreApellidos" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "ubicacionMaps" TEXT NOT NULL,
    "parroquia" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "numeroArboles" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL,
    "observaciones" TEXT,
    "fotoAntes" TEXT,
    "resolucionPdf" TEXT,
    "fotoDespues" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Ingresado',
    "motivoCancelacion" TEXT,
    "fechaAtencion" DATETIME
);
