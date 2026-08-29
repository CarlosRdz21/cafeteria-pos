"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const prisma_1 = require("../../config/prisma");
class AuthController {
    static async login(req, res, next) {
        try {
            const { username, email, password } = req.body;
            const identificadorAcceso = (username || email || '').toString().trim();
            if (!identificadorAcceso || !password) {
                return res.status(400).json({ error: 'Username and password required' });
            }
            const resultadoAutenticacion = await auth_service_1.AuthService.login(identificadorAcceso, password);
            res.json(resultadoAutenticacion);
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Invalid credentials') {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            next(error);
        }
    }
    static async debugUsers(req, res, next) {
        try {
            const token = String(req.query?.token || req.headers['x-auth-debug-token'] || '').trim();
            if (!process.env.AUTH_DEBUG_TOKEN || token !== process.env.AUTH_DEBUG_TOKEN) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const filasBaseDatos = await prisma_1.prisma.$queryRawUnsafe('SELECT DATABASE() AS databaseName');
            const usuarios = await prisma_1.prisma.user.findMany({
                select: {
                    id: true,
                    username: true,
                    name: true,
                    role: true,
                    active: true
                },
                orderBy: { id: 'asc' }
            });
            return res.json({
                ok: true,
                database: filasBaseDatos?.[0]?.databaseName || null,
                count: usuarios.length,
                users: usuarios
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
