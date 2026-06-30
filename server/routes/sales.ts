import express from 'express';
import { db } from '../db/index';
import { validateBody, SaleSchema, SaleBulkSchema } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import { Decimal } from 'decimal.js';

const router = express.Router();

// Register a Sale (FIFO Logic)
router.post('/', validateBody(SaleSchema), (req, res, next) => {
  const { product_id, quantity } = req.body;

  try {
    const transaction = db.transaction(() => {
      const product = db.prepare('SELECT sale_price FROM products WHERE id = ?').get(product_id) as any;
      if (!product) throw new AppError('Product not found', 404);

      // Check available stock first
      const stockRow = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total_stock FROM batches WHERE product_id = ? AND quantity > 0').get(product_id) as { total_stock: number };
      const stockActual = stockRow ? stockRow.total_stock : 0;
      if (quantity > stockActual) {
        throw new AppError(`INSUFFICIENT_STOCK:${stockActual}`, 400);
      }

      const batches = db.prepare(`
        SELECT * FROM batches 
        WHERE product_id = ? AND quantity > 0 
        ORDER BY created_at ASC
      `).all(product_id) as any[];

      let remainingToSell = quantity;
      let totalCost = new Decimal(0);

      for (const batch of batches) {
        if (remainingToSell <= 0) break;

        const sellFromThisBatch = Math.min(batch.quantity, remainingToSell);
        totalCost = totalCost.plus(new Decimal(sellFromThisBatch).times(new Decimal(batch.cost)));

        db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?')
          .run(sellFromThisBatch, batch.id);

        remainingToSell -= sellFromThisBatch;
      }

      const totalCostNum = totalCost.toNumber();

      db.prepare(`
        INSERT INTO sales (product_id, quantity, sale_price, total_cost)
        VALUES (?, ?, ?, ?)
      `).run(product_id, quantity, product.sale_price, totalCostNum);

      return { totalCost: totalCostNum, salePrice: product.sale_price };
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
    const transaction = db.transaction(() => {
      const results = [];
      for (const item of items) {
        const { product_id, quantity } = item;

        const product = db.prepare('SELECT sale_price FROM products WHERE id = ?').get(product_id) as any;
        if (!product) throw new AppError(`Product ${product_id} not found`, 404);

        // Check available stock first
        const stockRow = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total_stock FROM batches WHERE product_id = ? AND quantity > 0').get(product_id) as { total_stock: number };
        const stockActual = stockRow ? stockRow.total_stock : 0;
        if (quantity > stockActual) {
          throw new AppError(`INSUFFICIENT_STOCK:${product_id}:${stockActual}:${quantity}`, 400);
        }

        const batches = db.prepare(`
          SELECT * FROM batches 
          WHERE product_id = ? AND quantity > 0 
          ORDER BY created_at ASC
        `).all(product_id) as any[];
        let remainingToSell = quantity;
        let totalCost = new Decimal(0);

        for (const batch of batches) {
          if (remainingToSell <= 0) break;

          const sellFromThisBatch = Math.min(batch.quantity, remainingToSell);
          totalCost = totalCost.plus(new Decimal(sellFromThisBatch).times(new Decimal(batch.cost)));

          db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?')
            .run(sellFromThisBatch, batch.id);

          remainingToSell -= sellFromThisBatch;
        }

        const totalCostNum = totalCost.toNumber();

        db.prepare(`
          INSERT INTO sales (product_id, quantity, sale_price, total_cost, ticket_id, payment_method, status, customer_id)
          VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
        `).run(product_id, quantity, product.sale_price, totalCostNum, ticket_id, method, customer_id || null);

        results.push({ product_id, totalCost: totalCostNum, salePrice: product.sale_price });
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
        // Restore inventory: calculate average cost and add back to batches
        const avgCost = sale.total_cost / sale.quantity;

        db.prepare(`
          INSERT INTO batches (product_id, quantity, initial_quantity, cost)
          VALUES (?, ?, ?, ?)
        `).run(sale.product_id, sale.quantity, sale.quantity, avgCost);

        // Mark as voided
        db.prepare(`
          UPDATE sales SET status = 'voided' WHERE id = ?
        `).run(sale.id);
      }
    });

    transaction();
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

export default router;
