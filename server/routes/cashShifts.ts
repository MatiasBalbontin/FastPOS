import express from 'express';
import { db } from '../db/index';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validateBody, ShiftOpenSchema, ShiftCloseSchema } from '../middleware/validation';

const router = express.Router();

// Apply auth check
router.use(requireAuth);

// Helper to calculate totals for a shift timeframe
function getShiftTotals(openingTime: string) {
  // Sales
  const sales = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN quantity * sale_price ELSE 0 END), 0) as cash,
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN quantity * sale_price ELSE 0 END), 0) as card,
      COALESCE(SUM(CASE WHEN payment_method = 'cuenta_por_cobrar' THEN quantity * sale_price ELSE 0 END), 0) as receivables
    FROM sales
    WHERE status = 'completed' AND created_at >= ?
  `).get(openingTime) as { cash: number; card: number; receivables: number };

  // Debtor payments
  const payments = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END), 0) as cash,
      COALESCE(SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END), 0) as card
    FROM customer_payments
    WHERE status = 'completed' AND created_at >= ?
  `).get(openingTime) as { cash: number; card: number };

  // Expenses
  const expenses = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END), 0) as cash,
      COALESCE(SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END), 0) as card
    FROM expenses
    WHERE status = 'completed' AND created_at >= ?
  `).get(openingTime) as { cash: number; card: number };

  return { sales, payments, expenses };
}

// GET /api/cash-shifts/active - Get current active shift
router.get('/active', requirePermission('sales'), (req, res, next) => {
  try {
    const shift = db.prepare(`
      SELECT * FROM cash_shifts 
      WHERE status = 'open' 
      LIMIT 1
    `).get() as any;

    if (!shift) {
      return res.json({ active: false });
    }

    const { sales, payments, expenses } = getShiftTotals(shift.opening_time);

    const expectedCash = shift.opening_amount + sales.cash + payments.cash - expenses.cash;
    const expectedCard = sales.card + payments.card - expenses.card;

    res.json({
      active: true,
      shift,
      totals: {
        sales_cash: sales.cash,
        sales_card: sales.card,
        sales_receivables: sales.receivables,
        payments_cash: payments.cash,
        payments_card: payments.card,
        expenses_cash: expenses.cash,
        expenses_card: expenses.card,
        expected_cash: expectedCash,
        expected_card: expectedCard
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/cash-shifts/open - Open a new shift
router.post('/open', requirePermission('sales'), validateBody(ShiftOpenSchema), (req, res, next) => {
  const { opening_amount } = req.body;
  const userId = req.session.userId;

  try {
    // Check if there is an active open shift
    const existing = db.prepare("SELECT id FROM cash_shifts WHERE status = 'open'").get();
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una caja abierta en el sistema.' });
    }

    const result = db.prepare(`
      INSERT INTO cash_shifts (user_id, opening_amount)
      VALUES (?, ?)
    `).run(userId, opening_amount);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    next(error);
  }
});

// POST /api/cash-shifts/close - Close active shift
router.post('/close', requirePermission('sales'), validateBody(ShiftCloseSchema), (req, res, next) => {
  const { closing_amount_cash, closing_amount_card } = req.body;

  try {
    const shift = db.prepare("SELECT * FROM cash_shifts WHERE status = 'open'").get() as any;
    if (!shift) {
      return res.status(400).json({ error: 'No hay ninguna caja abierta en el sistema.' });
    }

    const { sales, payments, expenses } = getShiftTotals(shift.opening_time);

    const expectedCash = shift.opening_amount + sales.cash + payments.cash - expenses.cash;
    const expectedCard = sales.card + payments.card - expenses.card;

    db.prepare(`
      UPDATE cash_shifts
      SET 
        closing_amount_cash = ?,
        closing_amount_card = ?,
        expected_amount_cash = ?,
        expected_amount_card = ?,
        closing_time = CURRENT_TIMESTAMP,
        status = 'closed'
      WHERE id = ?
    `).run(closing_amount_cash, closing_amount_card, expectedCash, expectedCard, shift.id);

    // Get closed shift values
    const closed = db.prepare("SELECT * FROM cash_shifts WHERE id = ?").get(shift.id) as any;

    res.json({
      success: true,
      shift: closed,
      totals: {
        sales_cash: sales.cash,
        sales_card: sales.card,
        sales_receivables: sales.receivables,
        payments_cash: payments.cash,
        payments_card: payments.card,
        expenses_cash: expenses.cash,
        expenses_card: expenses.card,
        expected_cash: expectedCash,
        expected_card: expectedCard
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/cash-shifts - Get shift history
router.get('/', requirePermission('analytics'), (req, res, next) => {
  try {
    const shifts = db.prepare(`
      SELECT 
        s.*, 
        u.username as operator_name 
      FROM cash_shifts s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.opening_time DESC
    `).all() as any[];

    res.json(shifts);
  } catch (error) {
    next(error);
  }
});

export default router;
