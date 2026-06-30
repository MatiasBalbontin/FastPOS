import express from 'express';
import { db } from '../db/index';
import { requirePermission } from '../middleware/auth';

const router = express.Router();

router.use(requirePermission('receivables'));

// GET /api/receivables
router.get('/', (req, res, next) => {
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
    next(error);
  }
});

// GET /api/receivables/:customer_id
router.get('/:customer_id', (req, res, next) => {
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
    next(error);
  }
});

// POST /api/receivables/:customer_id/pay
router.post('/:customer_id/pay', (req, res, next) => {
  const { customer_id } = req.params;
  const { amount, method } = req.body;
  try {
    if (!amount || !method) throw new Error("Monto y método son obligatorios");
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) throw new Error("Monto inválido");

    // Calculate current debt
    const debtData = db.prepare(`
      SELECT 
        COALESCE((SELECT SUM(quantity * sale_price) FROM sales WHERE customer_id = ? AND payment_method = 'cuenta_por_cobrar' AND status = 'completed'), 0) -
        COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = ? AND status = 'completed'), 0) as debt
    `).get(customer_id, customer_id) as any;

    if (numAmount > debtData.debt) {
      throw new Error(`El abono ($${numAmount.toLocaleString()}) no puede superar la deuda pendiente ($${debtData.debt.toLocaleString()})`);
    }

    db.prepare(`
      INSERT INTO customer_payments (customer_id, amount, method)
      VALUES (?, ?, ?)
    `).run(customer_id, numAmount, method);
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

// POST /api/receivables/pay/void/:id
router.post('/pay/void/:id', (req, res, next) => {
  const { id } = req.params;
  try {
    db.prepare("UPDATE customer_payments SET status = 'voided' WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

export default router;
