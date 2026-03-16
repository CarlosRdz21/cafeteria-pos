"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('Falta DATABASE_URL en backend/.env');
    }
    await prisma.$queryRaw `SELECT 1`;
    console.log('Conexion MySQL OK (Hostinger)');
}
main()
    .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Fallo la conexion a MySQL:', message);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
