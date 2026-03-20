import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

import orderRoutes from './routes/order.routes';
import authRoutes from './routes/auth.routes';
import { initSocket } from './socket';
import productsRoutes from './routes/products.routes';
import productCategoriesRoutes from './routes/product-categories.routes';
import cashRegistersRoutes from './routes/cash-registers.routes';
import usersRoutes from './routes/users.routes';
import suppliesRoutes from './routes/supplies.routes';
import supplyCategoriesRoutes from './routes/supply-categories.routes';
import supplyMovementsRoutes from './routes/supply-movements.routes';
import expensesRoutes from './routes/expenses.routes';
import printerSettingsRoutes from './routes/printer-settings.routes';

import paymentRoutes from './routes/payment.routes';

dotenv.config();

const app = express();
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

const isPrivateHttpOrigin = (origin: string): boolean => {
  const match = origin.match(/^https?:\/\/([^/:]+)(?::\d+)?$/i);
  if (!match) return false;

  const host = match[1];
  if (host === 'localhost' || host === '127.0.0.1') return true;

  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;

  const private172 = host.match(/^172\.(\d{1,3})\.\d+\.\d+$/);
  if (private172) {
    const secondOctet = Number(private172[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }

  return false;
};

const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  return allowedOrigins.includes(origin) || isPrivateHttpOrigin(origin);
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));

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

const httpServer = createServer(app);

const io = new Server(httpServer, {
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

initSocket(io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as any;

    socket.data.user = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const role = socket.data.user.role;

  if (role === 'barista') socket.join('baristas');
  else if (role === 'waiter') socket.join('waiters');
  else socket.join('admins');

  console.log(`Socket conectado (${role})`);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
