import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import orderRoutes from './modules/orders/order.routes';
import authRoutes from './modules/auth/auth.routes';
import productsRoutes from './modules/products/products.routes';
import productCategoriesRoutes from './modules/products/product-categories.routes';
import cashRegistersRoutes from './modules/cash/cash-registers.routes';
import usersRoutes from './modules/users/users.routes';
import suppliesRoutes from './modules/inventory/supplies.routes';
import supplyCategoriesRoutes from './modules/inventory/supply-categories.routes';
import supplyMovementsRoutes from './modules/inventory/supply-movements.routes';
import expensesRoutes from './modules/expenses/expenses.routes';
import printerSettingsRoutes from './modules/printer/printer-settings.routes';
import promotionsRoutes from './modules/promotions/promotions.routes';
import paymentRoutes from './modules/payments/payment.routes';
import { ApplicationError, errorMiddleware } from './middlewares/error.middleware';
import { securityHeaders } from './middlewares/security.middleware';

if (process.env.LOCAL_ENV_FILE_LOADED !== 'true') {
  dotenv.config();
}

export const app = express();
app.disable('x-powered-by');
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '10mb';
const cloneHistoricoSoloLectura = process.env.CLONE_READ_ONLY === 'true';

const localAllowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
];

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/$/, '');
export const resolveAllowedOrigins = (environment: NodeJS.ProcessEnv = process.env): Set<string> => {
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
const allowedOrigins = resolveAllowedOrigins();

export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  return allowedOrigins.has(normalizeOrigin(origin));
};

export const isSocketOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  return allowedOrigins.has(normalizeOrigin(origin));
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new ApplicationError(403, 'CORS origin denied', 'Origin not allowed'));
  },
  credentials: true
}));
app.use(securityHeaders);
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));

// La copia histórica de producción se utiliza únicamente para reconciliación.
// AuthService también evita migrar hashes legacy cuando esta guarda está activa.
app.use('/api', (req, res, next) => {
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
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'cafeteria-pos-backend',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/product-categories', productCategoriesRoutes);
app.use('/api/cash-registers', cashRegistersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/supplies', suppliesRoutes);
app.use('/api/supply-categories', supplyCategoriesRoutes);
app.use('/api/supply-movements', supplyMovementsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/printer-settings', printerSettingsRoutes);
app.use('/api/promotions', promotionsRoutes);

app.use(errorMiddleware);
