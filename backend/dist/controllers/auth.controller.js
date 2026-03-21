"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const prisma_1 = require("../prisma");
class AuthController {
    static async login(req, res) {
        try {
            const { username, email, password } = req.body;
            const loginUsername = (username || email || '').toString().trim();
            if (!loginUsername || !password) {
                return res.status(400).json({ error: 'Username and password required' });
            }
            const data = await auth_service_1.AuthService.login(loginUsername, password);
            res.json(data);
        }
        catch (error) {
            const attemptedUsername = (req.body?.username || req.body?.email || '').toString().trim().toLowerCase();
            console.warn(`[auth] login response 401 username="${attemptedUsername}" reason="${error?.message || 'unknown'}"`);
            res.status(401).json({ error: error.message });
        }
    }
    static async debugUsers(req, res) {
        try {
            const token = String(req.query?.token || req.headers['x-auth-debug-token'] || '').trim();
            if (!process.env.AUTH_DEBUG_TOKEN || token !== process.env.AUTH_DEBUG_TOKEN) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const databaseRows = await prisma_1.prisma.$queryRawUnsafe('SELECT DATABASE() AS databaseName');
            const users = await prisma_1.prisma.user.findMany({
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
                database: databaseRows?.[0]?.databaseName || null,
                count: users.length,
                users
            });
        }
        catch (error) {
            return res.status(500).json({ error: error?.message || 'Debug auth error' });
        }
    }
}
exports.AuthController = AuthController;
