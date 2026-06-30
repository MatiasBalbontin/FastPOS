import express from 'express';
import { db } from '../db/index';

const router = express.Router();

// Get Fixed Costs
router.get('/', (req, res, next) => {
  try {
    const fixedCosts = db.prepare('SELECT * FROM fixed_costs ORDER BY created_at DESC').all();
    res.json(fixedCosts);
  } catch (error: any) {
    next(error);
  }
});

// Add Fixed Cost
router.post('/', (req, res, next) => {
  const { description, amount } = req.body;
  try {
    if (!description || !amount) {
      throw new Error('Todos los campos son requeridos');
    }
    db.prepare(`
      INSERT INTO fixed_costs (description, amount)
      VALUES (?, ?)
    `).run(description.toUpperCase(), amount);
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

// Delete Fixed Cost
router.delete('/:id', (req, res, next) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM fixed_costs WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

export default router;
