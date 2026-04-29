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

const tableInfoSales = db.prepare("PRAGMA table_info(sales)").all() as any[];
if (!tableInfoSales.some(col => col.name === 'ticket_id')) {
  db.exec(`
    ALTER TABLE sales ADD COLUMN ticket_id TEXT;
    ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'cash';
    ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed';
  `);
}
if (!tableInfoSales.some(col => col.name === 'customer_id')) {
  db.exec(`ALTER TABLE sales ADD COLUMN customer_id INTEGER;`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
`);

try {
  db.exec(`ALTER TABLE customer_payments ADD COLUMN status TEXT DEFAULT 'completed'`);
} catch (e) {
  // Ignore if column already exists
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

  // Delete Product
  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    try {
      const transaction = db.transaction(() => {
        // Enforce data integrity: do not delete products that have been sold
        const salesCount = db.prepare('SELECT COUNT(*) as count FROM sales WHERE product_id = ?').get(id) as any;
        if (salesCount.count > 0) {
          throw new Error('No se puede eliminar un producto con historial de ventas. Para sacarlo de tu catálogo, simplemente déjalo con Stock 0.');
        }

        // Delete all associated batches first to prevent orphans
        db.prepare('DELETE FROM batches WHERE product_id = ?').run(id);

        // Finally, delete the product
        db.prepare('DELETE FROM products WHERE id = ?').run(id);
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
    const { items, method = 'cash', customer_id } = req.body; // Array of { product_id, quantity }, and method
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
            INSERT INTO sales (product_id, quantity, sale_price, total_cost, ticket_id, payment_method, status, customer_id)
            VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)
          `).run(product_id, quantity, product.sale_price, totalCost, ticket_id, method, customer_id || null);

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
  app.get('/api/history', (req, res) => {
    const { startDate, endDate } = req.query;
    try {
      let salesDateFilter = "";
      let paymentsDateFilter = "";
      let params: any[] = [];
      let params2: any[] = [];
      if (startDate && endDate) {
        salesDateFilter = "AND datetime(s.created_at) BETWEEN datetime(?) AND datetime(?)";
        paymentsDateFilter = "AND datetime(p.created_at) BETWEEN datetime(?) AND datetime(?)";
        params = [startDate, endDate];
        params2 = [startDate, endDate];
      }

      const tickets = db.prepare(`
        SELECT 
          s.ticket_id as id, 
          'sale' as type,
          s.payment_method as method,
          s.status,
          s.created_at,
          SUM(s.quantity * s.sale_price) as total_amount,
          json_group_array(json_object(
            'product_id', s.product_id,
            'name', p.name,
            'quantity', s.quantity,
            'sale_price', s.sale_price
          )) as items,
          c.first_name || ' ' || c.last_name as customer_name
        FROM sales s
        JOIN products p ON s.product_id = p.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.ticket_id IS NOT NULL ${salesDateFilter}
        GROUP BY s.ticket_id
      `).all(...params) as any[];

      const payments = db.prepare(`
        SELECT 
          p.id as id, 
          'payment' as type,
          p.method as method,
          p.status,
          p.created_at,
          p.amount as total_amount,
          '[]' as items,
          c.first_name || ' ' || c.last_name as customer_name
        FROM customer_payments p
        JOIN customers c ON p.customer_id = c.id
        WHERE 1=1 ${paymentsDateFilter}
      `).all(...params2) as any[];

      const combined = [...tickets, ...payments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const limited = (startDate && endDate) ? combined : combined.slice(0, 100);

      const formatted = limited.map(t => ({
        ...t,
        items: JSON.parse(t.items)
      }));

      res.json(formatted);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/receivables/pay/void/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE customer_payments SET status = 'voided' WHERE id = ?").run(id);
      res.json({ success: true });
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

  // --- Customers & Receivables ---

  app.get('/api/customers', (req, res) => {
    try {
      const customers = db.prepare('SELECT * FROM customers ORDER BY first_name ASC').all();
      res.json(customers);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/customers', (req, res) => {
    const { rut, first_name, last_name } = req.body;
    try {
      if (!first_name || !last_name) throw new Error("Nombre y apellido son obligatorios");
      const result = db.prepare(`
        INSERT INTO customers (rut, first_name, last_name)
        VALUES (?, ?, ?)
      `).run(rut || null, first_name.toUpperCase(), last_name.toUpperCase());
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Ya existe un cliente con este RUT' });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  });

  app.get('/api/receivables', (req, res) => {
    try {
      const debtors = db.prepare(`
        WITH Debtors AS (
          SELECT 
            c.id, c.rut, c.first_name, c.last_name,
            COALESCE((
              SELECT SUM(s.quantity * s.sale_price) 
              FROM sales s 
              WHERE s.customer_id = c.id AND s.payment_method = 'cuenta_por_cobrar' AND s.status = 'completed'
            ), 0) - 
            COALESCE((
              SELECT SUM(p.amount) 
              FROM customer_payments p 
              WHERE p.customer_id = c.id AND p.status = 'completed'
            ), 0) as total_debt
          FROM customers c
        )
        SELECT * FROM Debtors
        WHERE total_debt > 0
        ORDER BY total_debt DESC
      `).all();
      res.json(debtors);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/receivables/:customer_id', (req, res) => {
    const { customer_id } = req.params;
    try {
      const debts = db.prepare(`
        SELECT 
          ticket_id, 
          created_at as date,
          SUM(quantity * sale_price) as amount,
          'debt' as type,
          status
        FROM sales 
        WHERE customer_id = ? AND payment_method = 'cuenta_por_cobrar' AND status = 'completed'
        GROUP BY ticket_id
      `).all(customer_id);

      const payments = db.prepare(`
        SELECT 
          id as ticket_id,
          created_at as date,
          amount,
          'payment' as type,
          method,
          status
        FROM customer_payments
        WHERE customer_id = ?
      `).all(customer_id);

      const history = [...debts, ...payments].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);

      res.json({ customer, history });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/receivables/:customer_id/pay', (req, res) => {
    const { customer_id } = req.params;
    const { amount, method } = req.body;
    try {
      if (!amount || !method) throw new Error("Monto y método son obligatorios");
      db.prepare(`
        INSERT INTO customer_payments (customer_id, amount, method)
        VALUES (?, ?, ?)
      `).run(customer_id, amount, method);
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
        SUM(CASE WHEN payment_method = 'cash' THEN quantity * sale_price ELSE 0 END) as cash_revenue_sales,
        SUM(CASE WHEN payment_method = 'card' THEN quantity * sale_price ELSE 0 END) as card_revenue_sales,
        SUM(CASE WHEN payment_method = 'cuenta_por_cobrar' THEN quantity * sale_price ELSE 0 END) as receivables_revenue
      FROM sales
      WHERE ${dateFilter} AND status != 'voided'
    `).get(...params) as any;

    const paymentsSummary = db.prepare(`
      SELECT 
        SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END) as cash_payments,
        SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END) as card_payments
      FROM customer_payments
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

    const cash_revenue = (summary.cash_revenue_sales || 0) + (paymentsSummary.cash_payments || 0);
    const card_revenue = (summary.card_revenue_sales || 0) + (paymentsSummary.card_payments || 0);
    summary.cash_revenue = cash_revenue;
    summary.card_revenue = card_revenue;
    summary.total_receivables = (summary.receivables_revenue || 0) - (paymentsSummary.cash_payments || 0) - (paymentsSummary.card_payments || 0);



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
