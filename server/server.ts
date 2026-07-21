import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

// Type extensions for express-session
declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
  }
}

// Database initializations
import { db } from './db/index';
import { initializeSchema } from './db/schema';
import { runMigrations } from './db/migrations';

initializeSchema();
runMigrations();

// Company settings always start empty and are filled in from the UI
// (Configuración > Datos de Empresa). They must never default from .env: if
// this project folder is ever copied to set up a new client instead of a
// fresh clone, an old .env would otherwise leak the previous client's name,
// RUT and bank account into the new install.
const checkSettings = db.prepare("SELECT COUNT(*) as count FROM company_settings").get() as { count: number };
if (checkSettings.count === 0) {
  const insertSetting = db.prepare("INSERT INTO company_settings (key, value) VALUES (?, ?)");
  insertSetting.run('company_name', '');
  insertSetting.run('company_rut', '');
  insertSetting.run('company_address', '');
  insertSetting.run('company_phone', '');
  insertSetting.run('company_email', '');
  insertSetting.run('company_bank_details', '');
}

import { requireAuth, hashPassword } from './middleware/auth';

// Users seeding
const checkUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (checkUsers.count === 0) {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
  const hashed = hashPassword(adminPassword);
  db.prepare("INSERT INTO users (username, password, permissions) VALUES (?, ?, ?)")
    .run('admin', hashed, '["sales","inventory","analytics","history","receivables","entities","expenses","fixed_costs","quotes","configuration"]');

  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin') {
    console.warn('\n[SEGURIDAD] El usuario "admin" se creó con la contraseña por defecto "admin". Cámbiela cuanto antes desde Configuración > Usuarios.\n');
  }
}

if (!process.env.SESSION_SECRET) {
  console.warn('\n[SEGURIDAD] SESSION_SECRET no está definido en .env; se está usando un valor de respaldo inseguro. Defina uno propio y único en .env.\n');
}

// Routes and middlewares imports
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import salesRouter from './routes/sales';
import inventoryRouter from './routes/inventory';
import analyticsRouter from './routes/analytics';
import expensesRouter from './routes/expenses';
import fixedCostsRouter from './routes/fixedCosts';
import receivablesRouter from './routes/receivables';
import entitiesRouter from './routes/entities';
import quotesRouter from './routes/quotes';
import settingsRouter from './routes/settings';
import usersRouter from './routes/users';
import historyRouter from './routes/history';
import cashShiftsRouter from './routes/cashShifts';
import systemRouter from './routes/system';

import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import { setupSwagger } from './swagger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: false
    }
  }));

  // Global General Rate Limiter
  app.use(generalLimiter);

  // Setup Swagger API docs (unprotected)
  setupSwagger(app);

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Mount Authentication (unprotected)
  app.use('/api/auth', authRouter);

  // Protected route middleware interceptor
  app.use('/api', requireAuth);

  // Protected Routes
  app.use('/api/products', productsRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api', inventoryRouter); // Handles /api/export and /api/products/bulk
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/expenses', expensesRouter);
  app.use('/api/fixed-costs', fixedCostsRouter);
  app.use('/api/receivables', receivablesRouter);
  app.use('/api/customers', entitiesRouter);
  app.use('/api/quotes', quotesRouter);
  app.use('/api/company-settings', settingsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/history', historyRouter);
  app.use('/api/cash-shifts', cashShiftsRouter);
  app.use('/api/system', systemRouter);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  // --- Vite Setup ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
