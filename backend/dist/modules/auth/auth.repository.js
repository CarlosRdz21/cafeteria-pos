"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
const prisma_1 = require("../../config/prisma");
class AuthRepository {
    /**
     * Localiza cuentas de instalaciones actuales y heredadas sin alterar sus campos persistidos.
     * Los bloques independientes permiten continuar cuando un entorno antiguo carece de username o email.
     */
    static async findByUsername(nombreUsuario) {
        const nombreNormalizado = nombreUsuario.trim().toLowerCase();
        const nombreExacto = nombreUsuario.trim();
        // MySQL nuevo: campo username
        try {
            const usuarioPorNombreExacto = await prisma_1.prisma.user.findFirst({
                where: { username: nombreExacto }
            });
            if (usuarioPorNombreExacto)
                return usuarioPorNombreExacto;
            const usuarioPorNombreNormalizado = await prisma_1.prisma.user.findUnique({
                where: { username: nombreNormalizado }
            });
            if (usuarioPorNombreNormalizado)
                return usuarioPorNombreNormalizado;
        }
        catch {
            // Algunos esquemas heredados no tenían el campo username.
        }
        // Compatible con ambos: email
        try {
            const usuarioPorCorreo = await prisma_1.prisma.user.findUnique({
                where: { email: nombreNormalizado }
            });
            if (usuarioPorCorreo)
                return usuarioPorCorreo;
        }
        catch {
            // El esquema puede no tener email en algunos entornos
        }
        // Como último recurso, instalaciones antiguas identificaban al usuario por name.
        return prisma_1.prisma.user.findFirst({
            where: { name: nombreExacto }
        });
    }
    static async updatePassword(idUsuario, hashContrasena) {
        await prisma_1.prisma.user.update({
            where: { id: idUsuario },
            data: { password: hashContrasena },
            select: { id: true },
        });
    }
}
exports.AuthRepository = AuthRepository;
