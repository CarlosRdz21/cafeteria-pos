import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AuthRepository } from './auth.repository';

export class AuthService {
  static async login(nombreUsuario: string, contrasena: string) {
    const usuario = await AuthRepository.findByUsername(nombreUsuario);
    if (!usuario) {
      throw new Error('Invalid credentials');
    }

    if (usuario.active === false) {
      throw new Error('Invalid credentials');
    }

    const contrasenaAlmacenada = String(usuario.password || '');
    const pareceHash = /^\$2[aby]\$\d{2}\$/.test(contrasenaAlmacenada);

    // La comparación en texto plano se conserva solo para migrar cuentas legacy
    // al primer acceso correcto; el mismo valor se reemplaza enseguida por bcrypt.
    const credencialesValidas = pareceHash
      ? await bcrypt.compare(contrasena, contrasenaAlmacenada)
      : contrasenaAlmacenada === contrasena;

    if (!credencialesValidas) {
      throw new Error('Invalid credentials');
    }

    if (!pareceHash && process.env.CLONE_READ_ONLY !== 'true') {
      const hashContrasenaMigrada = await bcrypt.hash(contrasena, 10);
      await AuthRepository.updatePassword(usuario.id, hashContrasenaMigrada);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const expiresIn: SignOptions['expiresIn'] =
      (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) || '8h';

    const token = jwt.sign(
      { userId: usuario.id, role: usuario.role },
      jwtSecret,
      { expiresIn }
    );

    return {
      token,
      user: {
        id: usuario.id,
        name: usuario.name,
        role: usuario.role,
      },
    };
  }
}
