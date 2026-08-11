import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { customersRouter } from './routes/customers';
import { productsRouter } from './routes/products';
import { stockMovementsRouter } from './routes/stockMovements';
import { challansRouter } from './routes/challans';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Root & Health Check ───────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'ERP Operations Portal Backend API',
    status: 'online',
    version: '1.0.0',
    documentation: 'https://github.com/rk-005/erp-system',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      customers: '/api/customers',
      products: '/api/products',
      stockMovements: '/api/stock-movements',
      challans: '/api/challans',
    },
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/stock-movements', stockMovementsRouter);
app.use('/api/challans', challansRouter);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: { message: 'Route not found', code: 'NOT_FOUND' },
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 ERP API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   CORS: ${allowedOrigins.join(', ')}`);
});

export default app;
