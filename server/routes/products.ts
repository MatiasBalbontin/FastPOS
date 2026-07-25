import express from 'express';
import { db } from '../db/index';
import { validateBody, ProductSchema, ProductUpdateSchema } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import { requirePermission } from '../middleware/auth';
import { logAudit } from '../db/audit';

const router = express.Router();

// El catálogo de productos y el alta rápida (POST) los usan también Ventas y
// Cotizaciones para cualquier operador autenticado (registro express desde el
// mostrador, selector de productos, etc.), así que sólo las acciones de
// administración de inventario propiamente tales (editar detalle, dar de baja,
// restaurar) quedan restringidas al permiso 'inventory'.

// Get all products
router.get('/', (req, res, next) => {
  const includeInactive = req.query.includeInactive === 'true';
  const whereClause = includeInactive ? '' : 'WHERE p.active = 1';
  try {
    const products = db.prepare(`
      SELECT 
        p.*, 
        COALESCE(SUM(b.quantity), 0) as total_stock,
        EXISTS(SELECT 1 FROM batches b2 WHERE b2.product_id = p.id AND b2.cost = 0) as has_zero_cost,
        (SELECT cost FROM batches b3 WHERE b3.product_id = p.id AND b3.quantity > 0 ORDER BY b3.created_at ASC LIMIT 1) as cost,
        COALESCE((SELECT SUM(s.quantity) FROM sales s WHERE s.product_id = p.id AND s.status = 'completed' AND datetime(s.created_at) >= datetime('now', '-30 days')), 0) as sales_30_days
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      ${whereClause}
      GROUP BY p.id
    `).all();
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// Get single product
router.get('/:id', (req, res, next) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
    if (!product) return next(new AppError('Product not found', 404));

    const batches = db.prepare('SELECT * FROM batches WHERE product_id = ? AND quantity > 0 ORDER BY created_at ASC').all(req.params.id);
    res.json({ ...product, batches });
  } catch (err) {
    next(err);
  }
});

// Create/Update Product
router.post('/', validateBody(ProductSchema), (req, res, next) => {
  try {
    const { id, name, type, sale_price, initial_stock, cost = 0 } = req.body;
    if (!id) return next(new AppError('ID es obligatorio', 400));

    const cleanId = String(id).trim().toUpperCase();
    const cleanName = String(name).trim().toUpperCase();
    const cleanType = String(type).trim().toUpperCase();
    const numSalePrice = parseFloat(sale_price) || 0;
    const numInitialStock = parseInt(initial_stock as string, 10) || 0;
    const numCost = parseFloat(cost as string) || 0;

    const transaction = db.transaction(() => {
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
    });
    transaction();
    
    logAudit(req.session.userId, req.session.username, 'CREATE_OR_UPDATE_PRODUCT', {
      id: cleanId,
      name: cleanName,
      sale_price: numSalePrice,
      initial_stock: numInitialStock,
      cost: numCost
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Update Product Details
router.put('/:id', requirePermission('inventory'), validateBody(ProductUpdateSchema), (req, res, next) => {
  const { name, type, sale_price, cost } = req.body;
  const { id } = req.params;
  try {
    const transaction = db.transaction(() => {
      if (name && type && sale_price !== undefined) {
        db.prepare(`
          UPDATE products 
          SET name = ?, type = ?, sale_price = ?
          WHERE id = ?
        `).run(name.toUpperCase(), type.toUpperCase(), sale_price, id);
      }

      if (cost !== undefined) {
        db.prepare(`
          UPDATE batches
          SET cost = ?
          WHERE product_id = ? AND quantity > 0
        `).run(cost, id);
      }

      if (req.body.new_stock !== undefined) {
        const new_stock = parseInt(req.body.new_stock, 10);
        const currentStockRow = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM batches WHERE product_id = ?').get(id) as any;
        const currentStock = currentStockRow.total;
        const diff = new_stock - currentStock;

        if (diff > 0) {
          db.prepare(`
            INSERT INTO batches (product_id, quantity, initial_quantity, cost)
            VALUES (?, ?, ?, ?)
          `).run(id, diff, diff, cost !== undefined ? cost : 0);
        } else if (diff < 0) {
          let remainingToRemove = -diff;
          const batches = db.prepare(`SELECT * FROM batches WHERE product_id = ? AND quantity > 0 ORDER BY created_at ASC`).all(id) as any[];
          for (const batch of batches) {
            if (remainingToRemove <= 0) break;
            const removeAmt = Math.min(batch.quantity, remainingToRemove);
            db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(removeAmt, batch.id);
            remainingToRemove -= removeAmt;
          }
        }
      }
    });
    transaction();

    logAudit(req.session.userId, req.session.username, 'UPDATE_PRODUCT', {
      id,
      name,
      sale_price,
      cost,
      new_stock: req.body.new_stock
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Soft Delete
router.delete('/:id', requirePermission('inventory'), (req, res, next) => {
  try {
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
    logAudit(req.session.userId, req.session.username, 'DELETE_PRODUCT', { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Restore
router.post('/:id/restore', requirePermission('inventory'), (req, res, next) => {
  try {
    db.prepare('UPDATE products SET active = 1 WHERE id = ?').run(req.params.id);
    logAudit(req.session.userId, req.session.username, 'RESTORE_PRODUCT', { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
