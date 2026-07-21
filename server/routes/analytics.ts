import express from 'express';
import { db } from '../db/index';
import { requirePermission } from '../middleware/auth';

const router = express.Router();

router.use(requirePermission('analytics'));

// Analytics
router.get('/', (req, res, next) => {
  const { period = 'month', startDate, endDate } = req.query;

  let dateFilter = "";
  let params: any[] = [];

  if (startDate && endDate) {
    dateFilter = "datetime(created_at) BETWEEN datetime(?) AND datetime(?)";
    params = [startDate, endDate];
  } else {
    let interval = "'-30 days'";
    if (period === 'day') interval = "'-1 day'";
    if (period === 'week') interval = "'-7 days'";
    dateFilter = `created_at >= datetime('now', ${interval})`;
  }

  try {
    const topProducts = db.prepare(`
      SELECT p.name, SUM(s.quantity) as volume, SUM(s.quantity * s.sale_price) as revenue
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE ${dateFilter} AND s.status = 'completed'
      GROUP BY s.product_id
      ORDER BY revenue DESC
      LIMIT 10
    `).all(...params);

    const categoryAnalysis = db.prepare(`
      SELECT p.type, SUM(s.quantity) as volume, SUM(s.quantity * s.sale_price) as revenue
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE ${dateFilter} AND s.status = 'completed'
      GROUP BY p.type
    `).all(...params);

    const summary = db.prepare(`
      SELECT
        SUM(quantity * sale_price) as total_revenue,
        SUM(total_cost) as total_cost,
        SUM(quantity * sale_price) - SUM(total_cost) as total_profit,
        SUM(CASE WHEN payment_method IN ('cash', 'card') THEN quantity * sale_price ELSE 0 END) as collected_revenue,
        SUM(CASE WHEN payment_method IN ('cash', 'card') THEN total_cost ELSE 0 END) as collected_cost,
        SUM(CASE WHEN payment_method = 'cash' THEN quantity * sale_price ELSE 0 END) as cash_sales_revenue,
        SUM(CASE WHEN payment_method = 'card' THEN quantity * sale_price ELSE 0 END) as card_sales_revenue,
        SUM(CASE WHEN payment_method = 'cuenta_por_cobrar' THEN quantity * sale_price ELSE 0 END) as receivables_revenue,
        SUM(CASE WHEN payment_method = 'cuenta_por_cobrar' THEN total_cost ELSE 0 END) as receivables_cost,
        COUNT(DISTINCT ticket_id) as sales_count
      FROM sales
      WHERE ${dateFilter} AND status = 'completed'
    `).get(...params) as any;

    const expensesSummary = db.prepare(`
      SELECT
        SUM(amount) as total_expenses,
        SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END) as cash_expenses,
        SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END) as card_expenses
      FROM expenses
      WHERE ${dateFilter} AND status != 'voided'
    `).get(...params) as any;

    // Abonos a cuentas por cobrar recibidos dentro del mismo período que se
    // está reportando, para que el efectivo/tarjeta "neto" mostrado siempre
    // corresponda al rango de fechas que el usuario está mirando (antes se
    // calculaba como acumulado histórico y descuadraba la caja del período).
    const periodPayments = db.prepare(`
      SELECT
        SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END) as cash_payments,
        SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END) as card_payments
      FROM customer_payments
      WHERE ${dateFilter} AND status = 'completed'
    `).get(...params) as any;

    const periodCashSales = summary.cash_sales_revenue || 0;
    const periodCardSales = summary.card_sales_revenue || 0;
    const periodCashPayments = periodPayments?.cash_payments || 0;
    const periodCardPayments = periodPayments?.card_payments || 0;

    summary.cash_revenue = periodCashSales + periodCashPayments;
    summary.card_revenue = periodCardSales + periodCardPayments;

    // El total "por cobrar" es un saldo vivo a la fecha (igual que en la
    // pantalla de Cuentas por Cobrar), no una métrica del período filtrado.
    const receivablesBalance = db.prepare(`
      SELECT
        COALESCE((SELECT SUM(quantity * sale_price) FROM sales WHERE payment_method = 'cuenta_por_cobrar' AND status = 'completed'), 0) -
        COALESCE((SELECT SUM(amount) FROM customer_payments WHERE status = 'completed'), 0) as balance
    `).get() as any;
    summary.total_receivables = Math.max(0, receivablesBalance?.balance || 0);

    const inventoryByFamily = db.prepare(`
      SELECT p.type, SUM(b.quantity) as total_stock, SUM(b.quantity * b.cost) as total_value
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      GROUP BY p.type
      ORDER BY total_value DESC
    `).all();

    const totalInventoryValue = db.prepare(`
      SELECT SUM(quantity * cost) as value FROM batches WHERE quantity > 0
    `).get() as any;

    const totalFixedCostsRow = db.prepare(`SELECT SUM(amount) as total FROM fixed_costs`).get() as any;
    // null (not 0) when nothing is configured yet, so the break-even chart can
    // show an honest "not configured" state instead of a fabricated target.
    const totalFixedCosts = totalFixedCostsRow.total || null;

    res.json({
      topProducts,
      categoryAnalysis,
      summary: {
        ...summary,
        ...expensesSummary,
        total_inventory_value: totalInventoryValue.value || 0,
        total_fixed_costs: totalFixedCosts
      },
      inventoryByFamily
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
