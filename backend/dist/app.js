"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSocketOriginAllowed = exports.isOriginAllowed = exports.resolveAllowedOrigins = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const order_routes_1 = __importDefault(require("./modules/orders/order.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const products_routes_1 = __importDefault(require("./modules/products/products.routes"));
const product_categories_routes_1 = __importDefault(require("./modules/products/product-categories.routes"));
const cash_registers_routes_1 = __importDefault(require("./modules/cash/cash-registers.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const supplies_routes_1 = __importDefault(require("./modules/inventory/supplies.routes"));
const supply_categories_routes_1 = __importDefault(require("./modules/inventory/supply-categories.routes"));
const supply_movements_routes_1 = __importDefault(require("./modules/inventory/supply-movements.routes"));
const expenses_routes_1 = __importDefault(require("./modules/expenses/expenses.routes"));
const printer_settings_routes_1 = __importDefault(require("./modules/printer/printer-settings.routes"));
const promotions_routes_1 = __importDefault(require("./modules/promotions/promotions.routes"));
const payment_routes_1 = __importDefault(require("./modules/payments/payment.routes"));
const error_middleware_1 = require("./middlewares/error.middleware");
const security_middleware_1 = require("./middlewares/security.middleware");
if (process.env.LOCAL_ENV_FILE_LOADED !== 'true') {
    dotenv_1.default.config();
}
exports.app = (0, express_1.default)();
exports.app.disable('x-powered-by');
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '10mb';
const cloneHistoricoSoloLectura = process.env.CLONE_READ_ONLY === 'true';
const localAllowedOrigins = [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
];
const normalizeOrigin = (origin) => origin.trim().replace(/\/$/, '');
const resolveAllowedOrigins = (environment = process.env) => {
    const configuredOrigins = [
        environment.FRONTEND_ORIGINS,
        environment.SOCKET_ORIGINS,
    ]
        .flatMap(value => (value || '').split(','))
        .map(normalizeOrigin)
        .filter(Boolean);
    return new Set([
        ...(environment.NODE_ENV === 'production' ? [] : localAllowedOrigins),
        ...configuredOrigins,
    ].map(normalizeOrigin));
};
exports.resolveAllowedOrigins = resolveAllowedOrigins;
const allowedOrigins = (0, exports.resolveAllowedOrigins)();
const isOriginAllowed = (origin) => {
    if (!origin)
        return true;
    return allowedOrigins.has(normalizeOrigin(origin));
};
exports.isOriginAllowed = isOriginAllowed;
const isSocketOriginAllowed = (origin) => {
    if (!origin)
        return true;
    return allowedOrigins.has(normalizeOrigin(origin));
};
exports.isSocketOriginAllowed = isSocketOriginAllowed;
exports.app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if ((0, exports.isOriginAllowed)(origin)) {
            callback(null, true);
            return;
        }
        callback(new error_middleware_1.ApplicationError(403, 'CORS origin denied', 'Origin not allowed'));
    },
    credentials: true
}));
exports.app.use(security_middleware_1.securityHeaders);
exports.app.use(express_1.default.json({ limit: jsonBodyLimit }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: jsonBodyLimit }));
// La copia histórica de producción se utiliza únicamente para reconciliación.
// AuthService también evita migrar hashes legacy cuando esta guarda está activa.
exports.app.use('/api', (req, res, next) => {
    const metodoSoloLectura = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const loginLocal = req.method === 'POST' && req.path === '/auth/login';
    if (cloneHistoricoSoloLectura && !metodoSoloLectura && !loginLocal) {
        return res.status(403).json({
            error: 'Clon histórico en modo de sólo lectura',
        });
    }
    return next();
});
// Las respuestas de la API reflejan caja, ventas e inventario en tiempo real.
// Evita que el navegador reutilice una respuesta 304 después de una operación reciente.
exports.app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});
exports.app.get('/', (_req, res) => {
    res.json({
        ok: true,
        service: 'cafeteria-pos-backend',
        timestamp: new Date().toISOString()
    });
});
exports.app.get('/health', (_req, res) => {
    res.json({
        ok: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});
exports.app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});
exports.app.use('/api/auth', auth_routes_1.default);
exports.app.use('/api/orders', order_routes_1.default);
exports.app.use('/api/payments', payment_routes_1.default);
exports.app.use('/api/products', products_routes_1.default);
exports.app.use('/api/product-categories', product_categories_routes_1.default);
exports.app.use('/api/cash-registers', cash_registers_routes_1.default);
exports.app.use('/api/users', users_routes_1.default);
exports.app.use('/api/supplies', supplies_routes_1.default);
exports.app.use('/api/supply-categories', supply_categories_routes_1.default);
exports.app.use('/api/supply-movements', supply_movements_routes_1.default);
exports.app.use('/api/expenses', expenses_routes_1.default);
exports.app.use('/api/printer-settings', printer_settings_routes_1.default);
exports.app.use('/api/promotions', promotions_routes_1.default);
exports.app.use(error_middleware_1.errorMiddleware);
