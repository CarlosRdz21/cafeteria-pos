"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crearServidor = crearServidor;
exports.iniciarServidor = iniciarServidor;
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app_1 = require("./app");
const cierre_controlado_1 = require("./config/cierre-controlado");
const prisma_1 = require("./config/prisma");
const socket_1 = require("./sockets/socket");
const environment_1 = require("./config/environment");
function crearServidor() {
    (0, environment_1.validateEnvironment)();
    const httpServer = (0, http_1.createServer)(app_1.app);
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if ((0, app_1.isSocketOriginAllowed)(origin)) {
                    callback(null, true);
                    return;
                }
                callback(new Error('Origin not allowed'));
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });
    (0, socket_1.initSocket)(io);
    (0, socket_1.configureSocketSecurity)(io);
    return { httpServer, io };
}
function iniciarServidor() {
    const { httpServer, io } = crearServidor();
    const databaseUrl = new URL(process.env.DATABASE_URL);
    const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''));
    const manejarCierre = (0, cierre_controlado_1.crearManejadorCierreControlado)({
        servidorHttp: httpServer,
        servidorSocket: io,
        desconectarPrisma: () => prisma_1.prisma.$disconnect(),
    });
    (0, cierre_controlado_1.registrarSenalesCierre)(manejarCierre);
    const port = process.env.PORT || 3000;
    httpServer.listen(port, () => {
        console.info(`[LOCAL] Backend activo en http://localhost:${port}`);
        console.info(`[LOCAL] MySQL validado: ${databaseUrl.hostname}:${databaseUrl.port}/${databaseName}`);
    });
    return { httpServer, io, manejarCierre };
}
if (require.main === module) {
    iniciarServidor();
}
