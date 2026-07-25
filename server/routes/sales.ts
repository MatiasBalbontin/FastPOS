import express from 'express';
import { db } from '../db/index';
import { validateBody, SaleSchema, SaleBulkSchema } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import { requirePermission } from '../middleware/auth';
import { Decimal } from 'decimal.js';
import { logAudit } from '../db/audit';

const router = express.Router();

router.use(requirePermission('sales'));

// Consumes stock from batches using FIFO, recording exactly which batch each
// unit came from so a later void can restore it to its original chronological
// slot instead of re-inserting it as a brand-new (and therefore "newest") batch.
function consumeFifo(product_id: string | number, quantity: number) {
  const batches = db.prepare(`
    SELECT * FROM batches
    WHERE product_id = ? AND quantity > 0
    ORDER BY created_at ASC
  `).all(product_id) as any[];

  let remainingToSell = quantity;
  let totalCost = new Decimal(0);
  const consumptions: { batch_id: number; quantity: number }[] = [];

  for (const batch of batches) {
    if (remainingToSell <= 0) break;

    const sellFromThisBatch = Math.min(batch.quantity, remainingToSell);
    totalCost = totalCost.plus(new Decimal(sellFromThisBatch).times(new Decimal(batch.cost)));

    db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?')
      .run(sellFromThisBatch, batch.id);

    consumptions.push({ batch_id: batch.id, quantity: sellFromThisBatch });
    remainingToSell -= sellFromThisBatch;
  }

  return { totalCost: totalCost.toNumber(), consumptions };
}

function recordConsumptions(sale_id: number | bigint, consumptions: { batch_id: number; quantity: number }[]) {
  const insertConsumption = db.prepare(`
    INSERT INTO sale_batch_consumptions (sale_id, batch_id, quantity)
    VALUES (?, ?, ?)
  `);
  for (const c of consumptions) {
    insertConsumption.run(sale_id, c.batch_id, c.quantity);
  }
}

function requireOpenShift() {
  const activeShift = db.prepare("SELECT id FROM cash_shifts WHERE status = 'open'").get();
  if (!activeShift) {
    throw new AppError('Debe iniciar la caja antes de registrar ventas', 400);
  }
}

function requireFiarPermission(req: express.Request, method: string) {
  if (
    method === 'cuenta_por_cobrar' &&
    req.session.username !== 'admin' &&
    !req.session.permissions?.includes('fiar')
  ) {
    throw new AppError('No tiene permisos para realizar ventas al fiado', 403);
  }
}

// Register a Sale (FIFO Logic)
router.post('/', validateBody(SaleSchema), (req, res, next) => {
  const { product_id, quantity, payment_method = 'cash', customer_id } = req.body;

  try {
    requireOpenShift();
    requireFiarPermission(req, payment_method);

    const ticket_id = `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const transaction = db.transaction(() => {
      const product = db.prepare('SELECT sale_price FROM products WHERE id = ?').get(product_id) as any;
      if (!product) throw new AppError('Product not found', 404);

      const stockRow = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total_stock FROM batches WHERE product_id = ? AND quantity > 0').get(product_id) as { total_stock: number };
      const stockActual = stockRow ? stockRow.total_stock : 0;
      if (quantity > stockActual) {
        throw new AppError(`INSUFFICIENT_STOCK:${stockActual}`, 400);
      }

      const { totalCost, consumptions } = consumeFifo(product_id, quantity);
      const parsedCustomerId = customer_id ? parseInt(String(customer_id), 10) : null;

      const result = db.prepare(`
        INSERT INTO sales (product_id, quantity, sale_price, total_cost, ticket_id, payment_method, status, customer_id)
        VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
      `).run(product_id, quantity, product.sale_price, totalCost, ticket_id, payment_method, parsedCustomerId);

      recordConsumptions(result.lastInsertRowid, consumptions);

      return { totalCost, salePrice: product.sale_price };
    });

    const result = transaction();
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (error.message && error.message.startsWith('INSUFFICIENT_STOCK:')) {
      const [_, stockActual] = error.message.split(':');
      return res.status(400).json({
        error: 'Stock insuficiente',
        available: parseInt(stockActual, 10),
        requested: quantity
      });
    }
    next(error);
  }
});

// Register Bulk Sales (POS Transaction)
router.post('/bulk', validateBody(SaleBulkSchema), (req, res, next) => {
  const { items, method = 'cash', customer_id } = req.body;
  const ticket_id = `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    requireFiarPermission(req, method);
    requireOpenShift();
  } catch (error: any) {
    return next(error);
  }

  try {
    const transaction = db.transaction(() => {
      const results = [];
      for (const item of items) {
        const { product_id, quantity } = item;

        const product = db.prepare('SELECT sale_price FROM products WHERE id = ?').get(product_id) as any;
        if (!product) throw new AppError(`Product ${product_id} not found`, 404);

        const stockRow = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total_stock FROM batches WHERE product_id = ? AND quantity > 0').get(product_id) as { total_stock: number };
        const stockActual = stockRow ? stockRow.total_stock : 0;
        if (quantity > stockActual) {
          throw new AppError(`INSUFFICIENT_STOCK:${product_id}:${stockActual}:${quantity}`, 400);
        }

        const { totalCost, consumptions } = consumeFifo(product_id, quantity);
        const parsedCustomerId = customer_id ? parseInt(String(customer_id), 10) : null;

        const insertResult = db.prepare(`
          INSERT INTO sales (product_id, quantity, sale_price, total_cost, ticket_id, payment_method, status, customer_id)
          VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
        `).run(product_id, quantity, product.sale_price, totalCost, ticket_id, method, parsedCustomerId);

        recordConsumptions(insertResult.lastInsertRowid, consumptions);

        results.push({ product_id, totalCost, salePrice: product.sale_price });
      }
      return results;
    });

    const results = transaction();
    res.json({ success: true, results });
  } catch (error: any) {
    if (error.message && error.message.startsWith('INSUFFICIENT_STOCK:')) {
      const [_, product_id, stockActual, quantity] = error.message.split(':');
      return res.status(400).json({
        error: 'Stock insuficiente',
        product_id,
        available: parseInt(stockActual, 10),
        requested: parseInt(quantity, 10)
      });
    }
    next(error);
  }
});

// Void a Sale
router.post('/void/:ticket_id', (req, res, next) => {
  const { ticket_id } = req.params;
  try {
    const transaction = db.transaction(() => {
      // Find the sales for this ticket that are not yet voided
      const sales = db.prepare(`
        SELECT * FROM sales WHERE ticket_id = ? AND status = 'completed'
      `).all(ticket_id) as any[];

      if (sales.length === 0) {
        throw new AppError('Ticket not found or already voided', 404);
      }

      for (const sale of sales) {
        // Restore stock to the exact batches it was drawn from, preserving
        // their original created_at so FIFO order is unaffected: a unit that
        // was first-out when sold becomes first-out again once restored.
        const consumptions = db.prepare(`
          SELECT batch_id, quantity FROM sale_batch_consumptions WHERE sale_id = ?
        `).all(sale.id) as { batch_id: number; quantity: number }[];

        if (consumptions.length > 0) {
          const restoreBatch = db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?');
          for (const c of consumptions) {
            restoreBatch.run(c.quantity, c.batch_id);
          }
        } else {
          // Legacy sale recorded before consumption tracking existed: fall
          // back to the old average-cost restoration as a new batch.
          const avgCost = sale.total_cost / sale.quantity;
          db.prepare(`
            INSERT INTO batches (product_id, quantity, initial_quantity, cost)
            VALUES (?, ?, ?, ?)
          `).run(sale.product_id, sale.quantity, sale.quantity, avgCost);
        }

        // Mark as voided
        db.prepare(`
          UPDATE sales SET status = 'voided' WHERE id = ?
        `).run(sale.id);
      }
    });

    transaction();
    
    logAudit(req.session.userId, req.session.username, 'VOID_SALE', { ticket_id });

    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

export default router;
