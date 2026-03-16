import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AuthRepository } from '../repositories/auth.repository';

export class AuthService {
  static async login(username: string, password: string) {
    const user = await AuthRepository.findByUsername(username);
    if (!user) throw new Error('Invalid credentials');

    const stored = String(user.password || '');
    const looksHashed = /^\$2[aby]\$\d{2}\$/.test(stored);

    let ok = false;
    if (looksHashed) {
      ok = await bcrypt.compare(password, stored);
    } else {
      // Compatibilidad temporal con usuarios legacy guardados en texto plano
      ok = stored === password;
    }

    if (!ok) throw new Error('Invalid credentials');

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const expiresIn: SignOptions['expiresIn'] =
      (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) || '8h';

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      jwtSecret,
      { expiresIn }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    };
  }
}
