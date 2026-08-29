"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSocket = void 0;
exports.authenticateSocketToken = authenticateSocketToken;
exports.getRoomForRole = getRoomForRole;
exports.configureSocketSecurity = configureSocketSecurity;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../config/prisma");
const socket_constants_1 = require("./socket.constants");
let io;
const initSocket = (server) => {
    io = server;
    return io;
};
exports.initSocket = initSocket;
/**
 * Valida el JWT y vuelve a consultar el usuario para no confiar en el rol
 * almacenado en un token que pudo quedar desactualizado.
 */
async function authenticateSocketToken(token) {
    if (typeof token !== 'string' || !token.trim())
        throw new Error('Unauthorized');
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (!decoded ||
            typeof decoded === 'string' ||
            !Number.isInteger(decoded.userId) ||
            decoded.userId <= 0) {
            throw new Error('Invalid token');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, role: true, active: true },
        });
        const room = getRoomForRole(user?.role);
        if (!user?.active || !room)
            throw new Error('Invalid token');
        return { userId: user.id, role: user.role };
    }
    catch {
        throw new Error('Invalid token');
    }
}
function getRoomForRole(role) {
    if (role === 'admin')
        return socket_constants_1.SOCKET_ROOMS.admins;
    if (role === 'barista')
        return socket_constants_1.SOCKET_ROOMS.baristas;
    if (role === 'mesero' || role === 'waiter')
        return socket_constants_1.SOCKET_ROOMS.waiters;
    return undefined;
}
function configureSocketSecurity(server) {
    server.use(async (socket, next) => {
        try {
            socket.data.user = await authenticateSocketToken(socket.handshake.auth?.token);
            next();
        }
        catch {
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
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};
exports.getIO = getIO;
