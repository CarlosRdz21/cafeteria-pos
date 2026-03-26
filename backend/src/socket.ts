import { Server } from 'socket.io';

let io: Server;

export const initSocket = (server: Server) => {
  io = server;
  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};
