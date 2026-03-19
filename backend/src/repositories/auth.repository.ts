import { prisma } from '../prisma';

export class AuthRepository {
  static async findByUsername(username: string) {
    const normalized = username.trim().toLowerCase();
    const exact = username.trim();

    // MySQL nuevo: campo username
    try {
      const byExactUsername = await (prisma as any).user.findFirst({
        where: { username: exact }
      });
      if (byExactUsername) return byExactUsername;

      const byUsername = await (prisma as any).user.findUnique({
        where: { username: normalized }
      });
      if (byUsername) return byUsername;
    } catch {
      // SQLite viejo no tiene username
    }

    // Compatible con ambos: email
    try {
      const byEmail = await (prisma as any).user.findUnique({
        where: { email: normalized }
      });
      if (byEmail) return byEmail;
    } catch {
      // El esquema puede no tener email en algunos entornos
    }

    // Fallback común: name
    return (prisma as any).user.findFirst({
      where: { name: exact }
    });
  }
}
