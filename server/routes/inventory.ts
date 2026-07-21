import express from 'express';
import { db } from '../db/index';
import { requirePermission } from '../middleware/auth';

const router = express.Router();

// NOTE: this router is mounted at the bare '/api' prefix in server.ts (it only
// owns the two specific paths below), so a router-level `router.use(...)`
// here would run for every '/api/*' request in the app, not just this
// router's own routes. The permission check must be attached per-route.

// Bulk Import
router.post('/products/bulk', requirePermission('inventory'), (req, res, next) => {
  const { products: importData } = req.body;

  try {
    if (!importData || !Array.isArray(importData)) {
      throw new Error('Datos de importación inválidos');
    }

    const transaction = db.transaction(() => {
      for (const item of importData) {
        const cleanId = String(item.id).trim().toUpperCase();
        const cleanName = String(item.name).trim().toUpperCase();
        const cleanType = String(item.type).trim().toUpperCase();
        const numSalePrice = parseFloat(item.sale_price) || 0;
        const numInitialStock = parseInt(item.initial_stock, 10) || 0;
        const numCost = parseFloat(item.cost) || 0;

        if (!cleanId || !cleanName) continue; // Skip malformed rows

        db.prepare(`
          INSERT INTO products (id, name, type, sale_price)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            type = excluded.type,
            sale_price = excluded.sale_price
        `).run(cleanId, cleanName, cleanType, numSalePrice);

        if (numInitialStock > 0) {
          db.prepare(`
            INSERT INTO batches (product_id, quantity, initial_quantity, cost)
            VALUES (?, ?, ?, ?)
          `).run(cleanId, numInitialStock, numInitialStock, numCost);
        }
      }
    });
    transaction();
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

// Export Data
router.get('/export', requirePermission('inventory'), (req, res, next) => {
  try {
    const products = db.prepare('SELECT * FROM products').all();
    const batches = db.prepare('SELECT * FROM batches').all();
    const sales = db.prepare("SELECT * FROM sales WHERE status = 'completed' AND datetime(created_at) >= datetime('now', '-30 days')").all();
    res.json({ products, batches, sales });
  } catch (error: any) {
    next(error);
  }
});

export default router;
