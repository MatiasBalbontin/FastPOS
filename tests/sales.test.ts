import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

describe('Sales & FIFO Logic', () => {
  let db: any;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        sale_price REAL NOT NULL,
        active INTEGER DEFAULT 1
      );

      CREATE TABLE batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        initial_quantity INTEGER NOT NULL,
        cost REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        sale_price REAL NOT NULL,
        total_cost REAL NOT NULL,
        ticket_id TEXT,
        payment_method TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);
  });

  it('should correctly calculate cost using FIFO', () => {
    // Setup: Product with two batches
    db.prepare('INSERT INTO products (id, name, type, sale_price) VALUES (?, ?, ?, ?)').run('P1', 'Test Product', 'Test', 100);
    db.prepare('INSERT INTO batches (product_id, quantity, initial_quantity, cost, created_at) VALUES (?, ?, ?, ?, ?)').run('P1', 10, 10, 50, '2023-01-01');
    db.prepare('INSERT INTO batches (product_id, quantity, initial_quantity, cost, created_at) VALUES (?, ?, ?, ?, ?)').run('P1', 10, 10, 60, '2023-01-02');

    // Action: Sell 15 units
    const quantity = 15;
    const product_id = 'P1';

    const batches = db.prepare(`
      SELECT * FROM batches 
      WHERE product_id = ? AND quantity > 0 
      ORDER BY created_at ASC
    `).all(product_id);

    let remainingToSell = quantity;
    let totalCost = 0;

    for (const batch of batches) {
      if (remainingToSell <= 0) break;
      const sellFromThisBatch = Math.min(batch.quantity, remainingToSell);
      totalCost += sellFromThisBatch * batch.cost;
      db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(sellFromThisBatch, batch.id);
      remainingToSell -= sellFromThisBatch;
    }

    // Cost should be (10 * 50) + (5 * 60) = 500 + 300 = 800
    expect(totalCost).toBe(800);
    expect(remainingToSell).toBe(0);

    // Verify stock
    const finalStock = db.prepare('SELECT SUM(quantity) as total FROM batches WHERE product_id = ?').get('P1').total;
    expect(finalStock).toBe(5);
  });

  it('should handle negative stock (pre-sales) correctly', () => {
    db.prepare('INSERT INTO products (id, name, type, sale_price) VALUES (?, ?, ?, ?)').run('P2', 'Test Product 2', 'Test', 100);
    // No batches yet

    const quantity = 5;
    const product_id = 'P2';

    // Simulate negative batch creation
    db.prepare('INSERT INTO batches (product_id, quantity, initial_quantity, cost) VALUES (?, ?, ?, ?)').run(product_id, -quantity, -quantity, 0);

    const stock = db.prepare('SELECT SUM(quantity) as total FROM batches WHERE product_id = ?').get('P2').total;
    expect(stock).toBe(-5);
  });
});
