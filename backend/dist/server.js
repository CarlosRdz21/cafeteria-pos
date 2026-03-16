"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const socket_1 = require("./socket");
const products_routes_1 = __importDefault(require("./routes/products.routes"));
const product_categories_routes_1 = __importDefault(require("./routes/product-categories.routes"));
const cash_registers_routes_1 = __importDefault(require("./routes/cash-registers.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const supplies_routes_1 = __importDefault(require("./routes/supplies.routes"));
const supply_categories_routes_1 = __importDefault(require("./routes/supply-categories.routes"));
const supply_movements_routes_1 = __importDefault(require("./routes/supply-movements.routes"));
const expenses_routes_1 = __importDefault(require("./routes/expenses.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '10mb';
const defaultAllowedOrigins = [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'http://10.2.3.114:4200',
    'https://dulcearomacafeteria.com',
    'https://www.dulcearomacafeteria.com',
    'capacitor://localhost',
    'http://localhost',
    'http://127.0.0.1'
];
const envAllowedOrigins = (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));
const isPrivateHttpOrigin = (origin) => {
    const match = origin.match(/^https?:\/\/([^/:]+)(?::\d+)?$/i);
    if (!match)
        return false;
    const host = match[1];
    if (host === 'localhost' || host === '127.0.0.1')
        return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(host))
        return true;
    if (/^192\.168\.\d+\.\d+$/.test(host))
        return true;
    const private172 = host.match(/^172\.(\d{1,3})\.\d+\.\d+$/);
    if (private172) {
        const secondOctet = Number(private172[1]);
        return secondOctet >= 16 && secondOctet <= 31;
    }
    return false;
};
const isOriginAllowed = (origin) => {
    if (!origin)
        return true;
    return allowedOrigins.includes(origin) || isPrivateHttpOrigin(origin);
};
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true
}));
app.use(express_1.default.json({ limit: jsonBodyLimit }));
app.use(express_1.default.urlencoded({ extended: true, limit: jsonBodyLimit }));
app.use('/api/auth', auth_routes_1.default);
app.use('/api/orders', order_routes_1.default);
app.use('/api/payments', payment_routes_1.default);
app.use('/api/products', products_routes_1.default);
app.use('/api/product-categories', product_categories_routes_1.default);
app.use('/api/cash-registers', cash_registers_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/supplies', supplies_routes_1.default);
app.use('/api/supply-categories', supply_categories_routes_1.default);
app.use('/api/supply-movements', supply_movements_routes_1.default);
app.use('/api/expenses', expenses_routes_1.default);
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`Not allowed by CORS: ${origin}`));
        },
        methods: ['GET', 'POST'],
        credentials: true
    }
});
(0, socket_1.initSocket)(io);
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token)
        return next(new Error('Unauthorized'));
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        socket.data.user = decoded;
        next();
    }
    catch {
        next(new Error('Invalid token'));
    }
});
io.on('connection', (socket) => {
    const role = socket.data.user.role;
    if (role === 'barista')
        socket.join('baristas');
    else if (role === 'waiter')
        socket.join('waiters');
    else
        socket.join('admins');
    console.log(`Socket conectado (${role})`);
});
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
