"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
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
            res.status(401).json({ error: error.message });
        }
    }
}
exports.AuthController = AuthController;
