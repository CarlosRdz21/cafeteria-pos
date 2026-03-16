"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_repository_1 = require("../repositories/auth.repository");
class AuthService {
    static async login(username, password) {
        const user = await auth_repository_1.AuthRepository.findByUsername(username);
        if (!user)
            throw new Error('Invalid credentials');
        const stored = String(user.password || '');
        const looksHashed = /^\$2[aby]\$\d{2}\$/.test(stored);
        let ok = false;
        if (looksHashed) {
            ok = await bcryptjs_1.default.compare(password, stored);
        }
        else {
            // Compatibilidad temporal con usuarios legacy guardados en texto plano
            ok = stored === password;
        }
        if (!ok)
            throw new Error('Invalid credentials');
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined');
        }
        const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, jwtSecret, { expiresIn });
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
exports.AuthService = AuthService;
