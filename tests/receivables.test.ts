import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

describe('Receivables Query & Business Logic', () => {
  let db: any;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        sale_price REAL NOT NULL
      );
      
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rut TEXT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL
      );

      CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        sale_price REAL NOT NULL,
        total_cost REAL NOT NULL,
        payment_method TEXT,
        status TEXT DEFAULT 'completed',
        customer_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE customer_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        method TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  it('should correctly calculate remaining customer debt and list debtors', () => {
    // Setup products & customer
    db.prepare("INSERT INTO products (id, name, type, sale_price) VALUES ('P1', 'Test', 'Test', 1000)").run();
    db.prepare("INSERT INTO customers (id, first_name, last_name) VALUES (1, 'CARLOS', 'GONZALEZ')").run();

    // 1. Buy $3,000 on credit
    db.prepare(`
      INSERT INTO sales (product_id, quantity, sale_price, total_cost, payment_method, customer_id)
      VALUES ('P1', 3, 1000, 500, 'cuenta_por_cobrar', 1)
    `).run();

    // 2. Repay $1,000
    db.prepare(`
      INSERT INTO customer_payments (customer_id, amount, method)
      VALUES (1, 1000, 'cash')
    `).run();

    // Calculate current debt
    const debtors = db.prepare(`
      WITH Debtors AS (
        SELECT 
          c.id, c.first_name,
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
    `).all() as any[];

    expect(debtors.length).toBe(1);
    expect(debtors[0].first_name).toBe('CARLOS');
    // Debt should be 3000 - 1000 = 2000
    expect(debtors[0].total_debt).toBe(2000);
  });

  it('should block payments exceeding current debt', () => {
    db.prepare("INSERT INTO products (id, name, type, sale_price) VALUES ('P1', 'Test', 'Test', 1000)").run();
    db.prepare("INSERT INTO customers (id, first_name, last_name) VALUES (2, 'MIGUEL', 'TAPIA')").run();

    // Buy $1,500 on credit
    db.prepare(`
      INSERT INTO sales (product_id, quantity, sale_price, total_cost, payment_method, customer_id)
      VALUES ('P1', 1.5, 1000, 500, 'cuenta_por_cobrar', 2)
    `).run();

    // Try to pay $2,000
    const paymentToPost = 2000;

    const debtData = db.prepare(`
      SELECT 
        COALESCE((SELECT SUM(quantity * sale_price) FROM sales WHERE customer_id = 2 AND payment_method = 'cuenta_por_cobrar' AND status = 'completed'), 0) -
        COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = 2 AND status = 'completed'), 0) as debt
    `).get() as any;

    let errorThrown = false;
    if (paymentToPost > debtData.debt) {
      errorThrown = true;
    } else {
      db.prepare(`
        INSERT INTO customer_payments (customer_id, amount, method)
        VALUES (2, ?, 'cash')
      `).run(paymentToPost);
    }

    expect(errorThrown).toBe(true);
  });
});
