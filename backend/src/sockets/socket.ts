import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { SOCKET_ROOMS, SocketRoom } from './socket.constants';

let io: Server;

export const initSocket = (server: Server) => {
  io = server;
  return io;
};

/**
 * Valida el JWT y vuelve a consultar el usuario para no confiar en el rol
 * almacenado en un token que pudo quedar desactualizado.
 */
export async function authenticateSocketToken(token: unknown): Promise<{ userId: number; role: string }> {
  if (typeof token !== 'string' || !token.trim()) throw new Error('Unauthorized');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    if (
      !decoded ||
      typeof decoded === 'string' ||
      !Number.isInteger(decoded.userId) ||
      decoded.userId <= 0
    ) {
      throw new Error('Invalid token');
    }

    const user = await (prisma as any).user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, active: true },
    });
    const room = getRoomForRole(user?.role);
    if (!user?.active || !room) throw new Error('Invalid token');

    return { userId: user.id, role: user.role };
  } catch {
    throw new Error('Invalid token');
  }
}

export function getRoomForRole(role: unknown): SocketRoom | undefined {
  if (role === 'admin') return SOCKET_ROOMS.admins;
  if (role === 'barista') return SOCKET_ROOMS.baristas;
  if (role === 'mesero' || role === 'waiter') return SOCKET_ROOMS.waiters;
  return undefined;
}

export function configureSocketSecurity(server: Server): void {
  server.use(async (socket, next) => {
    try {
      socket.data.user = await authenticateSocketToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  server.on('connection', socket => {
    const room = getRoomForRole(socket.data.user?.role);
    if (!room) {
      socket.disconnect(true);
      return;
    }
    socket.join(room);
  });
}

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};
