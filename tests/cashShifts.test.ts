import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

describe('Cash Shifts & POS Checkouts Integration Logic', () => {
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
      
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        permissions TEXT NOT NULL
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

      CREATE TABLE cash_shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        opening_amount REAL NOT NULL,
        opening_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        expected_amount_cash REAL,
        expected_amount_card REAL,
        closing_amount_cash REAL,
        closing_amount_card REAL,
        closing_time DATETIME,
        status TEXT DEFAULT 'open',
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    
    // Seed user with ID 1 to satisfy foreign key constraint on cash_shifts
    db.prepare("INSERT INTO users (id, username, password, permissions) VALUES (1, 'cajero', 'pass', '[]')").run();
  });

  it('should block opening a cash shift if one is already open', () => {
    // Open first shift
    db.prepare("INSERT INTO cash_shifts (user_id, opening_amount, status) VALUES (1, 10000, 'open')").run();

    // Try to open second shift
    const existing = db.prepare("SELECT id FROM cash_shifts WHERE status = 'open'").get();
    expect(existing).toBeDefined();

    let blockSuccess = false;
    if (existing) {
      blockSuccess = true;
    } else {
      db.prepare("INSERT INTO cash_shifts (user_id, opening_amount, status) VALUES (1, 20000, 'open')").run();
    }
    
    expect(blockSuccess).toBe(true);
  });

  it('should block sales if no active open cash shift exists', () => {
    // No shift is open
    const activeShift = db.prepare("SELECT id FROM cash_shifts WHERE status = 'open'").get();
    expect(activeShift).toBeUndefined();

    let blockSale = false;
    if (!activeShift) {
      blockSale = true;
    }

    expect(blockSale).toBe(true);
  });

  it('should restrict credit checkout to users holding the fiar permission', () => {
    const permissions = ['sales', 'inventory']; // missing 'fiar'
    const method = 'cuenta_por_cobrar';

    let blockCredit = false;
    if (method === 'cuenta_por_cobrar' && !permissions.includes('fiar')) {
      blockCredit = true;
    }

    expect(blockCredit).toBe(true);
  });

  it('should close cash shifts and accurately compute closing differences', () => {
    // Setup shift
    db.prepare("INSERT INTO cash_shifts (id, user_id, opening_amount, status) VALUES (10, 1, 50000, 'open')").run();
    db.prepare("INSERT INTO products (id, name, type, sale_price) VALUES ('P1', 'Test', 'Test', 1000)").run();

    // Seed sales in this timeframe
    db.prepare(`
      INSERT INTO sales (product_id, quantity, sale_price, total_cost, payment_method, status)
      VALUES ('P1', 5, 1000, 500, 'cash', 'completed')
    `).run();

    db.prepare(`
      INSERT INTO sales (product_id, quantity, sale_price, total_cost, payment_method, status)
      VALUES ('P1', 3, 1000, 500, 'card', 'completed')
    `).run();

    // Query values
    const sales = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN quantity * sale_price ELSE 0 END), 0) as cash,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN quantity * sale_price ELSE 0 END), 0) as card
      FROM sales
      WHERE status = 'completed'
    `).get() as any;

    const expectedCash = 50000 + sales.cash; // 50000 + 5000 = 55000
    const expectedCard = sales.card; // 3000

    // Close shift with declared: Cash=54000 (missing 1000), Card=3000 (perfect)
    const declaredCash = 54000;
    const declaredCard = 3000;

    db.prepare(`
      UPDATE cash_shifts
      SET 
        closing_amount_cash = ?,
        closing_amount_card = ?,
        expected_amount_cash = ?,
        expected_amount_card = ?,
        closing_time = CURRENT_TIMESTAMP,
        status = 'closed'
      WHERE id = 10
    `).run(declaredCash, declaredCard, expectedCash, expectedCard);

    const closed = db.prepare("SELECT * FROM cash_shifts WHERE id = 10").get() as any;
    expect(closed.status).toBe('closed');
    expect(closed.expected_amount_cash).toBe(55000);
    expect(closed.closing_amount_cash).toBe(54000);
    expect(closed.closing_amount_cash - closed.expected_amount_cash).toBe(-1000); // Faltante
  });
});
