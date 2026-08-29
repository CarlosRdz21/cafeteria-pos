"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../../config/prisma");
const publicUserSelect = {
    id: true,
    username: true,
    email: true,
    name: true,
    role: true,
    active: true,
    createdAt: true,
};
function toRole(value) {
    if (value === 'admin' || value === 'barista' || value === 'mesero')
        return value;
    return 'mesero';
}
class UsersController {
    static async list(_req, res, next) {
        try {
            const usuarios = await prisma_1.prisma.user.findMany({
                select: publicUserSelect,
                orderBy: { createdAt: 'desc' }
            });
            res.json(usuarios);
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const username = String(req.body?.username || '').trim().toLowerCase();
            const name = String(req.body?.name || '').trim();
            const password = String(req.body?.password || '');
            const role = toRole(req.body?.role);
            const active = req.body?.active !== false;
            if (!username || !name || !password) {
                return res.status(400).json({ error: 'username, name and password are required' });
            }
            const usuarioExistente = await prisma_1.prisma.user.findFirst({
                where: { username },
                select: { id: true }
            });
            if (usuarioExistente) {
                return res.status(409).json({ error: 'Username already exists' });
            }
            const hashContrasena = await bcryptjs_1.default.hash(password, 10);
            const usuarioCreado = await prisma_1.prisma.user.create({
                data: {
                    username,
                    name,
                    password: hashContrasena,
                    role,
                    active
                },
                select: publicUserSelect
            });
            res.status(201).json(usuarioCreado);
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const id = Number(req.params.id);
            if (!id)
                return res.status(400).json({ error: 'Invalid user id' });
            const usuarioExistente = await prisma_1.prisma.user.findUnique({
                where: { id },
                select: { id: true }
            });
            if (!usuarioExistente)
                return res.status(404).json({ error: 'User not found' });
            const datosActualizacion = {};
            if (req.body?.username !== undefined)
                datosActualizacion.username = String(req.body.username).trim().toLowerCase();
            if (req.body?.name !== undefined)
                datosActualizacion.name = String(req.body.name).trim();
            if (req.body?.password !== undefined) {
                const contrasenaSinProcesar = String(req.body.password || '');
                if (contrasenaSinProcesar) {
                    datosActualizacion.password = await bcryptjs_1.default.hash(contrasenaSinProcesar, 10);
                }
            }
            if (req.body?.role !== undefined)
                datosActualizacion.role = toRole(req.body.role);
            if (req.body?.active !== undefined)
                datosActualizacion.active = !!req.body.active;
            if (typeof datosActualizacion.username === 'string' && datosActualizacion.username) {
                const usuarioDuplicado = await prisma_1.prisma.user.findFirst({
                    where: {
                        username: datosActualizacion.username,
                        NOT: { id }
                    },
                    select: { id: true }
                });
                if (usuarioDuplicado) {
                    return res.status(409).json({ error: 'Username already exists' });
                }
            }
            const usuarioActualizado = await prisma_1.prisma.user.update({
                where: { id },
                data: datosActualizacion,
                select: publicUserSelect
            });
            res.json(usuarioActualizado);
        }
        catch (error) {
            next(error);
        }
    }
    static async remove(req, res, next) {
        try {
            const id = Number(req.params.id);
            if (!id)
                return res.status(400).json({ error: 'Invalid user id' });
            const usuarioExistente = await prisma_1.prisma.user.findUnique({
                where: { id },
                select: { id: true }
            });
            if (!usuarioExistente)
                return res.status(404).json({ error: 'User not found' });
            await prisma_1.prisma.user.delete({ where: { id } });
            res.json({ success: true });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UsersController = UsersController;
