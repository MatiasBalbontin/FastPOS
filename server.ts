import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'inventory.db'));

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    sale_price REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    initial_quantity INTEGER NOT NULL,
    cost REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    sale_price REAL NOT NULL,
    total_cost REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

const tableInfo = db.prepare("PRAGMA table_info(sales)").all() as any[];
const hasTicketId = tableInfo.some(col => col.name === 'ticket_id');
if (!hasTicketId) {
  db.exec(`
    ALTER TABLE sales ADD COLUMN ticket_id TEXT;
    ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'cash';
    ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed';
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- API Routes ---

  // Get all products with total stock and alert status
  app.get('/api/products', (req, res) => {
    const products = db.prepare(`
      SELECT 
        p.*, 
        COALESCE(SUM(b.quantity), 0) as total_stock,
        EXISTS(SELECT 1 FROM batches b2 WHERE b2.product_id = p.id AND b2.cost = 0) as has_zero_cost,
        (SELECT cost FROM batches b3 WHERE b3.product_id = p.id AND b3.quantity > 0 ORDER BY b3.created_at ASC LIMIT 1) as cost
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      GROUP BY p.id
    `).all();
    res.json(products);
  });

  // Get single product details including batches
  app.get('/api/products/:id', (req, res) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const batches = db.prepare('SELECT * FROM batches WHERE product_id = ? AND quantity > 0 ORDER BY created_at ASC').all(req.params.id);
    res.json({ ...product, batches });
  });

  // Create or Update Product (Express Creation)
  app.post('/api/products', (req, res) => {
    const { id, name, type, sale_price, initial_stock, cost = 0 } = req.body;

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO products (id, name, type, sale_price)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          sale_price = excluded.sale_price
      `).run(id, name.toUpperCase(), type.toUpperCase(), sale_price);

      if (initial_stock > 0) {
        db.prepare(`
          INSERT INTO batches (product_id, quantity, initial_quantity, cost)
          VALUES (?, ?, ?, ?)
        `).run(id, initial_stock, initial_stock, cost);
      }
    });

    transaction();
    res.json({ success: true });
  });

  // Update Product Details
  app.put('/api/products/:id', (req, res) => {
    const { name, type, sale_price, cost } = req.body;
    const { id } = req.params;

    try {
      const transaction = db.transaction(() => {
        db.prepare(`
          UPDATE products 
          SET name = ?, type = ?, sale_price = ?
          WHERE id = ?
        `).run(name.toUpperCase(), type.toUpperCase(), sale_price, id);

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
            // Incrementar stock: crear nuevo lote
            db.prepare(`
              INSERT INTO batches (product_id, quantity, initial_quantity, cost)
              VALUES (?, ?, ?, ?)
            `).run(id, diff, diff, cost !== undefined ? cost : 0);
          } else if (diff < 0) {
            // Reducir stock: descontar de lotes más antiguos (FIFO)
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
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Bulk Import
  app.post('/api/products/bulk', (req, res) => {
    const { products: importData } = req.body;

    try {
      const transaction = db.transaction(() => {
        for (const item of importData) {
          db.prepare(`
            INSERT INTO products (id, name, type, sale_price)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              type = excluded.type,
              sale_price = excluded.sale_price
          `).run(item.id, item.name.toUpperCase(), item.type.toUpperCase(), item.sale_price);

          if (item.initial_stock > 0) {
            db.prepare(`
              INSERT INTO batches (product_id, quantity, initial_quantity, cost)
              VALUES (?, ?, ?, ?)
            `).run(item.id, item.initial_stock, item.initial_stock, item.cost || 0);
          }
        }
      });
      transaction();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Export Data
  app.get('/api/export', (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    const batches = db.prepare('SELECT * FROM batches').all();
    res.json({ products, batches });
  });

  // Register a Sale (FIFO Logic)
  app.post('/api/sales', (req, res) => {
    const { product_id, quantity } = req.body;

    try {
      const transaction = db.transaction(() => {
        const product = db.prepare('SELECT sale_price FROM products WHERE id = ?').get(product_id) as any;
        if (!product) throw new Error('Product not found');

        const batches = db.prepare(`
          SELECT * FROM batches 
          WHERE product_id = ? AND quantity > 0 
          ORDER BY created_at ASC
        `).all(product_id) as any[];

        let remainingToSell = quantity;
        let totalCost = 0;

        for (const batch of batches) {
          if (remainingToSell <= 0) break;

          const sellFromThisBatch = Math.min(batch.quantity, remainingToSell);
          totalCost += sellFromThisBatch * batch.cost;

          db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?')
            .run(sellFromThisBatch, batch.id);

          remainingToSell -= sellFromThisBatch;
        }

        if (remainingToSell > 0) {
          const lastBatch = db.prepare('SELECT cost FROM batches WHERE product_id = ? ORDER BY created_at DESC LIMIT 1').get(product_id) as any;
          const fallbackCost = lastBatch ? lastBatch.cost : 0;
          totalCost += remainingToSell * fallbackCost;
          
          db.prepare('INSERT INTO batches (product_id, quantity, initial_quantity, cost) VALUES (?, ?, ?, ?)')
            .run(product_id, -remainingToSell, -remainingToSell, fallbackCost);
        }

        db.prepare(`
          INSERT INTO sales (product_id, quantity, sale_price, total_cost)
          VALUES (?, ?, ?, ?)
        `).run(product_id, quantity, product.sale_price, totalCost);

        return { totalCost, salePrice: product.sale_price };
      });

      const result = transaction();
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Register Bulk Sales (POS Transaction)
  app.post('/api/sales/bulk', (req, res) => {
    const { items, method = 'cash' } = req.body; // Array of { product_id, quantity }, and method
    const ticket_id = `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      const transaction = db.transaction(() => {
        const results = [];
        for (const item of items) {
          const { product_id, quantity } = item;

          const product = db.prepare('SELECT sale_price FROM products WHERE id = ?').get(product_id) as any;
          if (!product) throw new Error(`Product ${product_id} not found`);

          const batches = db.prepare(`
            SELECT * FROM batches 
            WHERE product_id = ? AND quantity > 0 
            ORDER BY created_at ASC
          `).all(product_id) as any[];
          let remainingToSell = quantity;
          let totalCost = 0;

          for (const batch of batches) {
            if (remainingToSell <= 0) break;

            const sellFromThisBatch = Math.min(batch.quantity, remainingToSell);
            totalCost += sellFromThisBatch * batch.cost;

            db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?')
              .run(sellFromThisBatch, batch.id);

            remainingToSell -= sellFromThisBatch;
          }

          if (remainingToSell > 0) {
            const lastBatch = db.prepare('SELECT cost FROM batches WHERE product_id = ? ORDER BY created_at DESC LIMIT 1').get(product_id) as any;
            const fallbackCost = lastBatch ? lastBatch.cost : 0;
            totalCost += remainingToSell * fallbackCost;
            
            db.prepare('INSERT INTO batches (product_id, quantity, initial_quantity, cost) VALUES (?, ?, ?, ?)')
              .run(product_id, -remainingToSell, -remainingToSell, fallbackCost);
          }

          db.prepare(`
            INSERT INTO sales (product_id, quantity, sale_price, total_cost, ticket_id, payment_method, status)
            VALUES (?, ?, ?, ?, ?, ?, 'completed')
          `).run(product_id, quantity, product.sale_price, totalCost, ticket_id, method);

          results.push({ product_id, totalCost, salePrice: product.sale_price });
        }
        return results;
      });

      const results = transaction();
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get Sales History
  app.get('/api/sales/history', (req, res) => {
    try {
      const tickets = db.prepare(`
        SELECT 
          s.ticket_id, 
          s.payment_method,
          s.status,
          s.created_at,
          SUM(s.quantity * s.sale_price) as total_amount,
          json_group_array(json_object(
            'product_id', s.product_id,
            'name', p.name,
            'quantity', s.quantity,
            'sale_price', s.sale_price
          )) as items
        FROM sales s
        JOIN products p ON s.product_id = p.id
        WHERE s.ticket_id IS NOT NULL
        GROUP BY s.ticket_id
        ORDER BY s.created_at DESC
        LIMIT 100
      `).all() as any[];

      // Parse JSON items
      const formatted = tickets.map(t => ({
        ...t,
        items: JSON.parse(t.items)
      }));

      res.json(formatted);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Void a Sale
  app.post('/api/sales/void/:ticket_id', (req, res) => {
    const { ticket_id } = req.params;
    try {
      const transaction = db.transaction(() => {
        // Find the sales for this ticket that are not yet voided
        const sales = db.prepare(`
          SELECT * FROM sales WHERE ticket_id = ? AND status = 'completed'
        `).all(ticket_id) as any[];

        if (sales.length === 0) {
          throw new Error('Ticket not found or already voided');
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
      res.status(400).json({ error: error.message });
    }
  });

  // Get Expenses
  app.get('/api/expenses', (req, res) => {
    try {
      const expenses = db.prepare('SELECT * FROM expenses ORDER BY created_at DESC LIMIT 100').all();
      res.json(expenses);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Add Expense
  app.post('/api/expenses', (req, res) => {
    const { description, amount, method } = req.body;
    try {
      if (!description || !amount || !method) {
        throw new Error('Todos los campos son requeridos');
      }
      db.prepare(`
        INSERT INTO expenses (description, amount, method)
        VALUES (?, ?, ?)
      `).run(description.toUpperCase(), amount, method);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Analytics
  app.get('/api/analytics', (req, res) => {
    const { period = 'month', startDate, endDate } = req.query;

    let dateFilter = "";
    let params: any[] = [];

    if (startDate && endDate) {
      dateFilter = "datetime(created_at) BETWEEN datetime(?) AND datetime(?)";
      params = [startDate, endDate];
    } else {
      let interval = "'-30 days'";
      if (period === 'day') interval = "'-1 day'";
      if (period === 'week') interval = "'-7 days'";
      dateFilter = `created_at >= datetime('now', ${interval})`;
    }

    const topProducts = db.prepare(`
      SELECT p.name, SUM(s.quantity) as volume, SUM(s.quantity * s.sale_price) as revenue
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE ${dateFilter} AND s.status != 'voided'
      GROUP BY s.product_id
      ORDER BY revenue DESC
      LIMIT 10
    `).all(...params);

    const categoryAnalysis = db.prepare(`
      SELECT p.type, SUM(s.quantity) as volume, SUM(s.quantity * s.sale_price) as revenue
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE ${dateFilter} AND s.status != 'voided'
      GROUP BY p.type
    `).all(...params);

    const summary = db.prepare(`
      SELECT 
        SUM(quantity * sale_price) as total_revenue,
        SUM(total_cost) as total_cost,
        SUM(quantity * sale_price) - SUM(total_cost) as total_profit,
        SUM(CASE WHEN payment_method = 'cash' THEN quantity * sale_price ELSE 0 END) as cash_revenue,
        SUM(CASE WHEN payment_method = 'card' THEN quantity * sale_price ELSE 0 END) as card_revenue
      FROM sales
      WHERE ${dateFilter} AND status != 'voided'
    `).get(...params) as any;

    const expensesSummary = db.prepare(`
      SELECT 
        SUM(amount) as total_expenses,
        SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END) as cash_expenses,
        SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END) as card_expenses
      FROM expenses
      WHERE ${dateFilter}
    `).get(...params) as any;

    const inventoryByFamily = db.prepare(`
      SELECT p.type, SUM(b.quantity) as total_stock, SUM(b.quantity * b.cost) as total_value
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      GROUP BY p.type
      ORDER BY total_value DESC
    `).all();

    const totalInventoryValue = db.prepare(`
      SELECT SUM(quantity * cost) as value FROM batches WHERE quantity > 0
    `).get() as any;

    res.json({ topProducts, categoryAnalysis, summary: { ...summary, ...expensesSummary, total_inventory_value: totalInventoryValue.value || 0 }, inventoryByFamily });
  });

  // --- Vite Setup ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
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
