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
    const { name, type, sale_price } = req.body;
    const { id } = req.params;

    try {
      db.prepare(`
        UPDATE products 
        SET name = ?, type = ?, sale_price = ?
        WHERE id = ?
      `).run(name.toUpperCase(), type.toUpperCase(), sale_price, id);
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
        const totalAvailable = batches.reduce((acc, b) => acc + b.quantity, 0);

        if (totalAvailable < quantity) {
          throw new Error('Insufficient stock');
        }

        for (const batch of batches) {
          if (remainingToSell <= 0) break;

          const sellFromThisBatch = Math.min(batch.quantity, remainingToSell);
          totalCost += sellFromThisBatch * batch.cost;
          
          db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?')
            .run(sellFromThisBatch, batch.id);
          
          remainingToSell -= sellFromThisBatch;
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
    const { items } = req.body; // Array of { product_id, quantity }
    
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
          const totalAvailable = batches.reduce((acc, b) => acc + b.quantity, 0);

          if (totalAvailable < quantity) {
            throw new Error(`Insufficient stock for ${product_id}`);
          }

          for (const batch of batches) {
            if (remainingToSell <= 0) break;

            const sellFromThisBatch = Math.min(batch.quantity, remainingToSell);
            totalCost += sellFromThisBatch * batch.cost;
            
            db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?')
              .run(sellFromThisBatch, batch.id);
            
            remainingToSell -= sellFromThisBatch;
          }

          db.prepare(`
            INSERT INTO sales (product_id, quantity, sale_price, total_cost)
            VALUES (?, ?, ?, ?)
          `).run(product_id, quantity, product.sale_price, totalCost);
          
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
      SELECT p.name, SUM(s.quantity) as total_sold
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE ${dateFilter}
      GROUP BY s.product_id
      ORDER BY total_sold DESC
      LIMIT 10
    `).all(...params);

    const categoryAnalysis = db.prepare(`
      SELECT p.type, SUM(s.quantity) as total_sold
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE ${dateFilter}
      GROUP BY p.type
    `).all(...params);

    const summary = db.prepare(`
      SELECT 
        SUM(quantity * sale_price) as total_revenue,
        SUM(total_cost) as total_cost,
        SUM(quantity * sale_price) - SUM(total_cost) as total_profit
      FROM sales
      WHERE ${dateFilter}
    `).get(...params) as any;

    const inventoryByFamily = db.prepare(`
      SELECT p.type, SUM(b.quantity) as total_stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      GROUP BY p.type
      ORDER BY total_stock DESC
    `).all();

    res.json({ topProducts, categoryAnalysis, summary, inventoryByFamily });
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
