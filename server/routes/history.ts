import express from 'express';
import { db } from '../db/index';
import { requirePermission } from '../middleware/auth';

const router = express.Router();

// GET /api/history - Retrieve unified sales, payments, and expenses history
router.get('/', requirePermission('history'), (req, res, next) => {
  const { startDate, endDate } = req.query;
  try {
    // Get configured timezone
    const tzSetting = db.prepare("SELECT value FROM company_settings WHERE key = 'timezone_offset'").get() as { value: string } | undefined;
    const tz = tzSetting?.value || 'localtime';

    let salesDateFilter = '';
    let paymentsDateFilter = '';
    let expensesDateFilter = '';
    let params: any[] = [];
    let params2: any[] = [];
    let params3: any[] = [];

    if (startDate && endDate) {
      salesDateFilter = "AND datetime(s.created_at, ?) BETWEEN datetime(?) AND datetime(?)";
      paymentsDateFilter = "AND datetime(p.created_at, ?) BETWEEN datetime(?) AND datetime(?)";
      expensesDateFilter = "AND datetime(e.created_at, ?) BETWEEN datetime(?) AND datetime(?)";
      params = [tz, startDate, endDate];
      params2 = [tz, startDate, endDate];
      params3 = [tz, startDate, endDate];
    }

    const tickets = db.prepare(`
      SELECT 
        s.ticket_id as id, 
        'sale' as type,
        s.payment_method as method,
        s.status,
        s.created_at,
        SUM(s.quantity * s.sale_price) as total_amount,
        SUM(s.total_cost) as total_cost,
        json_group_array(json_object(
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

    const expenses = db.prepare(`
      SELECT 
        CAST(e.id AS TEXT) as id,
        'expense' as type,
        e.method as method,
        e.status,
        e.created_at,
        e.amount as total_amount,
        json_group_array(json_object(
          'name', e.description,
          'quantity', 1,
          'sale_price', e.amount
        )) as items,
        NULL as customer_name
      FROM expenses e
      WHERE 1=1 ${expensesDateFilter}
      GROUP BY e.id
    `).all(...params3) as any[];

    const combined = [...tickets, ...payments, ...expenses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const limited = (startDate && endDate) ? combined : combined.slice(0, 100);

    const formatted = limited.map(t => ({
      ...t,
      items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items
    }));

    res.json(formatted);
  } catch (error: any) {
    next(error);
  }
});

// GET /api/history/export - Raw, ungrouped rows for manual reconciliation in Excel.
// Unlike GET /, this returns every sale line item (not grouped by ticket), includes
// voided records with their status, and is not capped at 100 rows.
router.get('/export', requirePermission('history'), (req, res, next) => {
  const { startDate, endDate } = req.query;
  try {
    const tzSetting = db.prepare("SELECT value FROM company_settings WHERE key = 'timezone_offset'").get() as { value: string } | undefined;
    const tz = tzSetting?.value || 'localtime';

    let salesDateFilter = '';
    let paymentsDateFilter = '';
    let expensesDateFilter = '';
    let salesParams: any[] = [];
    let paymentsParams: any[] = [];
    let expensesParams: any[] = [];

    if (startDate && endDate) {
      salesDateFilter = "WHERE datetime(s.created_at, ?) BETWEEN datetime(?) AND datetime(?)";
      paymentsDateFilter = "WHERE datetime(p.created_at, ?) BETWEEN datetime(?) AND datetime(?)";
      expensesDateFilter = "WHERE datetime(created_at, ?) BETWEEN datetime(?) AND datetime(?)";
      salesParams = [tz, startDate, endDate];
      paymentsParams = [tz, startDate, endDate];
      expensesParams = [tz, startDate, endDate];
    }

    const sales = db.prepare(`
      SELECT
        s.id,
        s.ticket_id,
        s.created_at,
        p.name as product_name,
        s.quantity,
        s.sale_price,
        (s.quantity * s.sale_price) as line_total,
        s.total_cost,
        s.payment_method,
        s.status,
        c.first_name || ' ' || c.last_name as customer_name
      FROM sales s
      JOIN products p ON s.product_id = p.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ${salesDateFilter}
      ORDER BY s.created_at ASC
    `).all(...salesParams);

    const payments = db.prepare(`
      SELECT
        p.id,
        p.created_at,
        p.amount,
        p.method,
        p.status,
        c.first_name || ' ' || c.last_name as customer_name
      FROM customer_payments p
      JOIN customers c ON p.customer_id = c.id
      ${paymentsDateFilter}
      ORDER BY p.created_at ASC
    `).all(...paymentsParams);

    const expenses = db.prepare(`
      SELECT id, created_at, description, amount, method, status
      FROM expenses
      ${expensesDateFilter}
      ORDER BY created_at ASC
    `).all(...expensesParams);

    res.json({ sales, payments, expenses });
  } catch (error: any) {
    next(error);
  }
});

export default router;
