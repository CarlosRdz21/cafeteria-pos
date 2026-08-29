"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const node_path_1 = __importDefault(require("node:path"));
const { validarConfiguracionBasePruebas } = require('../../scripts/test-database-safety.js');
async function main() {
    dotenv_1.default.config({
        path: node_path_1.default.resolve(__dirname, '..', '..', '.env.test'),
        override: true,
        quiet: true,
    });
    const resumen = validarConfiguracionBasePruebas(process.env);
    const prisma = new client_1.PrismaClient();
    try {
        await prisma.$queryRaw `SELECT 1`;
        console.info(`Conexion MySQL local OK: ${resumen.host}:${resumen.puerto}/${resumen.nombreBaseDatos}`);
    }
    finally {
        await prisma.$disconnect();
    }
}
main()
    .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Fallo la conexion a MySQL:', message);
    process.exitCode = 1;
});
