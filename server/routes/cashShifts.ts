import express from 'express';
import { db } from '../db/index';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validateBody, ShiftOpenSchema, ShiftCloseSchema } from '../middleware/validation';
import { logAudit } from '../db/audit';

const router = express.Router();

// Apply auth check
router.use(requireAuth);

// Totals for one specific shift, scoped by shift_id rather than a date
// range — with one shift per operator, several can be open at once, and a
// date-range filter would double-count a sale across every shift open at
// that moment.
function getShiftTotals(shiftId: number) {
  const sales = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN quantity * sale_price ELSE 0 END), 0) as cash,
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN quantity * sale_price ELSE 0 END), 0) as card,
      COALESCE(SUM(CASE WHEN payment_method = 'cuenta_por_cobrar' THEN quantity * sale_price ELSE 0 END), 0) as receivables
    FROM sales
    WHERE status = 'completed' AND shift_id = ?
  `).get(shiftId) as { cash: number; card: number; receivables: number };

  // Debtor payments
  const payments = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END), 0) as cash,
      COALESCE(SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END), 0) as card
    FROM customer_payments
    WHERE status = 'completed' AND shift_id = ?
  `).get(shiftId) as { cash: number; card: number };

  // Expenses
  const expenses = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END), 0) as cash,
      COALESCE(SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END), 0) as card
    FROM expenses
    WHERE status = 'completed' AND shift_id = ?
  `).get(shiftId) as { cash: number; card: number };

  return { sales, payments, expenses };
}

// GET /api/cash-shifts/active - Get the CALLING operator's active shift.
// Cash shifts are per-operator: another user's open shift is irrelevant here.
router.get('/active', requirePermission('sales'), (req, res, next) => {
  try {
    const shift = db.prepare(`
      SELECT * FROM cash_shifts
      WHERE status = 'open' AND user_id = ?
      LIMIT 1
    `).get(req.session.userId) as any;

    if (!shift) {
      return res.json({ active: false });
    }

    const { sales, payments, expenses } = getShiftTotals(shift.id);

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

// POST /api/cash-shifts/open - Open a new shift for the calling operator
router.post('/open', requirePermission('sales'), validateBody(ShiftOpenSchema), (req, res, next) => {
  const { opening_amount } = req.body;
  const userId = req.session.userId;

  try {
    // Only block if THIS operator already has one open — other operators'
    // open shifts don't conflict, each one runs their own cash count.
    const existing = db.prepare("SELECT id FROM cash_shifts WHERE status = 'open' AND user_id = ?").get(userId);
    if (existing) {
      return res.status(400).json({ error: 'Ya tiene una caja abierta. Ciérrela antes de abrir una nueva.' });
    }

    const result = db.prepare(`
      INSERT INTO cash_shifts (user_id, opening_amount)
      VALUES (?, ?)
    `).run(userId, opening_amount);

    logAudit(userId, req.session.username, 'OPEN_SHIFT', { opening_amount });

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    next(error);
  }
});

// POST /api/cash-shifts/close - Close the calling operator's active shift
router.post('/close', requirePermission('sales'), validateBody(ShiftCloseSchema), (req, res, next) => {
  const { closing_amount_cash, closing_amount_card } = req.body;

  try {
    const shift = db.prepare("SELECT * FROM cash_shifts WHERE status = 'open' AND user_id = ?").get(req.session.userId) as any;
    if (!shift) {
      return res.status(400).json({ error: 'No tiene ninguna caja abierta.' });
    }

    const { sales, payments, expenses } = getShiftTotals(shift.id);

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

    logAudit(req.session.userId, req.session.username, 'CLOSE_SHIFT', {
      shift_id: shift.id,
      closing_cash: closing_amount_cash,
      expected_cash: expectedCash,
      closing_card: closing_amount_card,
      expected_card: expectedCard
    });

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

// GET /api/cash-shifts - Get shift history (all operators)
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
