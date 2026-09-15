import { createServer } from 'http';
import { Server } from 'socket.io';

import { app, isSocketOriginAllowed } from './app';
import {
  crearManejadorCierreControlado,
  registrarSenalesCierre,
} from './config/cierre-controlado';
import { prisma } from './config/prisma';
import { configureSocketSecurity, initSocket } from './sockets/socket';
import { validateEnvironment } from './config/environment';

export function crearServidor() {
  validateEnvironment();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isSocketOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  initSocket(io);
  configureSocketSecurity(io);
  return { httpServer, io };
}

export function iniciarServidor() {
  const { httpServer, io } = crearServidor();
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''));
  const manejarCierre = crearManejadorCierreControlado({
    servidorHttp: httpServer,
    servidorSocket: io,
    desconectarPrisma: () => prisma.$disconnect(),
  });
  registrarSenalesCierre(manejarCierre);

  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => {
    console.info(`[LOCAL] Backend activo en http://localhost:${port}`);
    console.info(
      `[LOCAL] MySQL validado: ${databaseUrl.hostname}:${databaseUrl.port}/${databaseName}`,
    );
  });

  return { httpServer, io, manejarCierre };
}

if (require.main === module) {
  iniciarServidor();
}
