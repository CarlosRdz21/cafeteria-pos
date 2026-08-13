import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';

const { validarConfiguracionBasePruebas } = require('../../scripts/test-database-safety.js');

async function main() {
  dotenv.config({
    path: path.resolve(__dirname, '..', '..', '.env.test'),
    override: true,
    quiet: true,
  });
  const resumen = validarConfiguracionBasePruebas(process.env);
  const prisma = new PrismaClient();

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.info(
      `Conexion MySQL local OK: ${resumen.host}:${resumen.puerto}/${resumen.nombreBaseDatos}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Fallo la conexion a MySQL:', message);
    process.exitCode = 1;
  });
