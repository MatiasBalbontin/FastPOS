import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

describe('History Operations Query logic', () => {
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
        ticket_id TEXT,
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

      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        method TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  it('should retrieve unified operations history sorted chronologically', () => {
    // Seed
    db.prepare("INSERT INTO products (id, name, type, sale_price) VALUES ('P1', 'COCA COLA', 'BEBIDAS', 1500)").run();
    db.prepare("INSERT INTO customers (id, first_name, last_name) VALUES (1, 'JUAN', 'PEREZ')").run();
    
    // 1. A sale on day 1
    db.prepare(`
      INSERT INTO sales (product_id, quantity, sale_price, total_cost, ticket_id, payment_method, customer_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('P1', 2, 1500, 1000, 'TKT-001', 'cuenta_por_cobrar', 1, '2023-01-01 10:00:00');

    // 2. A payment on day 2
    db.prepare(`
      INSERT INTO customer_payments (customer_id, amount, method, created_at)
      VALUES (?, ?, ?, ?)
    `).run(1, 1500, 'cash', '2023-01-02 12:00:00');

    // 3. An expense on day 3
    db.prepare(`
      INSERT INTO expenses (description, amount, method, created_at)
      VALUES (?, ?, ?, ?)
    `).run('Luz local', 10000, 'cash', '2023-01-03 14:00:00');

    // Query Sales (type: sale)
    const tickets = db.prepare(`
      SELECT 
        s.ticket_id as id, 
        'sale' as type,
        s.payment_method as method,
        s.status,
        s.created_at,
        SUM(s.quantity * s.sale_price) as total_amount,
        c.first_name || ' ' || c.last_name as customer_name
      FROM sales s
      JOIN products p ON s.product_id = p.id
      LEFT JOIN customers c ON s.customer_id = c.id
      GROUP BY s.ticket_id
    `).all() as any[];

    // Query Payments (type: payment)
    const payments = db.prepare(`
      SELECT 
        p.id as id, 
        'payment' as type,
        p.method as method,
        p.status,
        p.created_at,
        p.amount as total_amount,
        c.first_name || ' ' || c.last_name as customer_name
      FROM customer_payments p
      JOIN customers c ON p.customer_id = c.id
    `).all() as any[];

    // Query Expenses (type: expense)
    const expenses = db.prepare(`
      SELECT 
        CAST(e.id AS TEXT) as id,
        'expense' as type,
        e.method as method,
        e.status,
        e.created_at,
        e.amount as total_amount,
        NULL as customer_name
      FROM expenses e
      GROUP BY e.id
    `).all() as any[];

    const combined = [...tickets, ...payments, ...expenses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    expect(combined.length).toBe(3);
    // Most recent first: Expense (Jan 3), then Payment (Jan 2), then Sale (Jan 1)
    expect(combined[0].type).toBe('expense');
    expect(combined[0].total_amount).toBe(10000);
    
    expect(combined[1].type).toBe('payment');
    expect(combined[1].total_amount).toBe(1500);
    expect(combined[1].customer_name).toBe('JUAN PEREZ');
    
    expect(combined[2].type).toBe('sale');
    expect(combined[2].total_amount).toBe(3000); // 2 * 1500
    expect(combined[2].customer_name).toBe('JUAN PEREZ');
  });
});
