import express from 'express';
import { db } from '../db/index';
import { validateBody, ExpenseSchema } from '../middleware/validation';
import { requirePermission } from '../middleware/auth';
import { logAudit } from '../db/audit';

const router = express.Router();

router.use(requirePermission('expenses'));

// Get Expenses
router.get('/', (req, res, next) => {
  try {
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY created_at DESC LIMIT 100').all();
    res.json(expenses);
  } catch (error: any) {
    next(error);
  }
});

// Add Expense
router.post('/', validateBody(ExpenseSchema), (req, res, next) => {
  const { description, amount, method } = req.body;
  try {
    db.prepare(`
      INSERT INTO expenses (description, amount, method)
      VALUES (?, ?, ?)
    `).run(description.toUpperCase(), amount, method);
    
    logAudit(req.session.userId, req.session.username, 'ADD_EXPENSE', { description, amount, method });
    
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

// Void Expense
router.post('/void/:id', (req, res, next) => {
  const { id } = req.params;
  try {
    db.prepare("UPDATE expenses SET status = 'voided' WHERE id = ?").run(id);
    logAudit(req.session.userId, req.session.username, 'VOID_EXPENSE', { id });
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

export default router;
