"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_repository_1 = require("./auth.repository");
class AuthService {
    static async login(nombreUsuario, contrasena) {
        const usuario = await auth_repository_1.AuthRepository.findByUsername(nombreUsuario);
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
            ? await bcryptjs_1.default.compare(contrasena, contrasenaAlmacenada)
            : contrasenaAlmacenada === contrasena;
        if (!credencialesValidas) {
            throw new Error('Invalid credentials');
        }
        if (!pareceHash && process.env.CLONE_READ_ONLY !== 'true') {
            const hashContrasenaMigrada = await bcryptjs_1.default.hash(contrasena, 10);
            await auth_repository_1.AuthRepository.updatePassword(usuario.id, hashContrasenaMigrada);
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined');
        }
        const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
        const token = jsonwebtoken_1.default.sign({ userId: usuario.id, role: usuario.role }, jwtSecret, { expiresIn });
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
exports.AuthService = AuthService;
