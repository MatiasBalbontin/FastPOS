import express from 'express';
import { db } from '../db/index';

const router = express.Router();

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
      WHERE ${dateFilter} AND s.status != 'voided'
      GROUP BY s.product_id
      ORDER BY revenue DESC
      LIMIT 10
    `).all(...params);

    const categoryAnalysis = db.prepare(`
      SELECT p.type, SUM(s.quantity) as volume, SUM(s.quantity * s.sale_price) as revenue
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE ${dateFilter} AND s.status != 'voided'
      GROUP BY p.type
    `).all(...params);

    const summary = db.prepare(`
      SELECT 
        SUM(quantity * sale_price) as total_revenue,
        SUM(total_cost) as total_cost,
        SUM(quantity * sale_price) - SUM(total_cost) as total_profit,
        SUM(CASE WHEN payment_method IN ('cash', 'card') THEN quantity * sale_price ELSE 0 END) as collected_revenue,
        SUM(CASE WHEN payment_method IN ('cash', 'card') THEN total_cost ELSE 0 END) as collected_cost,
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

    let cumulativeDateFilter = "";
    let cumulativeParams: any[] = [];

    if (startDate && endDate) {
      cumulativeDateFilter = "datetime(created_at) <= datetime(?)";
      cumulativeParams = [endDate];
    } else {
      cumulativeDateFilter = "1=1";
    }

    const cumulativeSales = db.prepare(`
      SELECT 
        SUM(CASE WHEN payment_method = 'cash' THEN quantity * sale_price ELSE 0 END) as cash_revenue_sales,
        SUM(CASE WHEN payment_method = 'card' THEN quantity * sale_price ELSE 0 END) as card_revenue_sales,
        SUM(CASE WHEN payment_method = 'cuenta_por_cobrar' THEN quantity * sale_price ELSE 0 END) as receivables_revenue
      FROM sales
      WHERE ${cumulativeDateFilter} AND status = 'completed'
    `).get(...cumulativeParams) as any;

    const cumulativePayments = db.prepare(`
      SELECT 
        SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END) as cash_payments,
        SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END) as card_payments
      FROM customer_payments
      WHERE ${cumulativeDateFilter} AND status = 'completed'
    `).get(...cumulativeParams) as any;

    const cumulativeExpenses = db.prepare(`
      SELECT 
        SUM(CASE WHEN method = 'cash' THEN amount ELSE 0 END) as cash_expenses,
        SUM(CASE WHEN method = 'card' THEN amount ELSE 0 END) as card_expenses
      FROM expenses
      WHERE ${cumulativeDateFilter} AND status != 'voided'
    `).get(...cumulativeParams) as any;

    const cumCashSales = cumulativeSales?.cash_revenue_sales || 0;
    const cumCashPayments = cumulativePayments?.cash_payments || 0;
    const cumCashExpenses = cumulativeExpenses?.cash_expenses || 0;
    const netCumulativeCash = cumCashSales + cumCashPayments - cumCashExpenses;

    const cumCardSales = cumulativeSales?.card_revenue_sales || 0;
    const cumCardPayments = cumulativePayments?.card_payments || 0;
    const cumCardExpenses = cumulativeExpenses?.card_expenses || 0;
    const netCumulativeCard = cumCardSales + cumCardPayments - cumCardExpenses;

    const cumReceivablesRevenue = cumulativeSales?.receivables_revenue || 0;
    const cumulativeReceivables = Math.max(0, cumReceivablesRevenue - cumCashPayments - cumCardPayments);

    const periodCashExpenses = expensesSummary.cash_expenses || 0;
    const periodCardExpenses = expensesSummary.card_expenses || 0;

    summary.cash_revenue = netCumulativeCash + periodCashExpenses;
    summary.card_revenue = netCumulativeCard + periodCardExpenses;
    summary.total_receivables = cumulativeReceivables;

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
    const totalFixedCosts = totalFixedCostsRow.total || 0;

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
