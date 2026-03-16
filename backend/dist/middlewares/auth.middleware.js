"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authMiddleware(roles) {
    return (req, res, next) => {
        const header = req.headers.authorization;
        if (!header)
            return res.status(401).json({ error: 'No token' });
        const token = header.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            if (roles && !roles.includes(decoded.role)) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            next();
        }
        catch {
            res.status(401).json({ error: 'Invalid token' });
        }
    };
}
