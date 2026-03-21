"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthRepository = void 0;
const prisma_1 = require("../prisma");
class AuthRepository {
    static async findByUsername(username) {
        const normalized = username.trim().toLowerCase();
        const exact = username.trim();
        // MySQL nuevo: campo username
        try {
            const byExactUsername = await prisma_1.prisma.user.findFirst({
                where: { username: exact }
            });
            if (byExactUsername)
                return byExactUsername;
            const byUsername = await prisma_1.prisma.user.findUnique({
                where: { username: normalized }
            });
            if (byUsername)
                return byUsername;
        }
        catch {
            // SQLite viejo no tiene username
        }
        // Compatible con ambos: email
        try {
            const byEmail = await prisma_1.prisma.user.findUnique({
                where: { email: normalized }
            });
            if (byEmail)
                return byEmail;
        }
        catch {
            // El esquema puede no tener email en algunos entornos
        }
        // Fallback común: name
        return prisma_1.prisma.user.findFirst({
            where: { name: exact }
        });
    }
}
exports.AuthRepository = AuthRepository;
