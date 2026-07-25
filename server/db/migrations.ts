import { db } from './index';

export function runMigrations() {
  try {
    db.exec(`ALTER TABLE products ADD COLUMN active INTEGER DEFAULT 1`);
  } catch (e) {}

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

  try {
    db.exec(`ALTER TABLE customer_payments ADD COLUMN status TEXT DEFAULT 'completed'`);
  } catch (e) {}

  try { db.exec(`ALTER TABLE customers ADD COLUMN type TEXT DEFAULT 'cliente'`); } catch (e) {}
  try { db.exec(`ALTER TABLE customers ADD COLUMN address TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE customers ADD COLUMN contact TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE customers ADD COLUMN phone TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE customers ADD COLUMN email TEXT`); } catch (e) {}

  try {
    db.exec(`ALTER TABLE expenses ADD COLUMN status TEXT DEFAULT 'completed'`);
  } catch (e) {}

  try {
    const hasTimezone = db.prepare("SELECT 1 FROM company_settings WHERE key = 'timezone_offset'").get();
    if (!hasTimezone) {
      db.prepare("INSERT INTO company_settings (key, value) VALUES ('timezone_offset', 'localtime')").run();
    }
  } catch (e) {}
}
