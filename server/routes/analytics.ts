import express from 'express';
import { db } from '../db/index';
import { requirePermission } from '../middleware/auth';

const router = express.Router();

router.use(requirePermission('analytics'));

// GET /api/analytics/sales-details - Get full, detailed list of sales line-items for export.
router.get('/sales-details', (req, res, next) => {
  const { startDate, endDate } = req.query;

  // Get configured timezone
  const tzSetting = db.prepare("SELECT value FROM company_settings WHERE key = 'timezone_offset'").get() as { value: string } | undefined;
  const tz = tzSetting?.value || 'localtime';

  let dateFilter = "";
  let params: any[] = [];

  if (startDate && endDate) {
    dateFilter = "datetime(s.created_at, ?) BETWEEN datetime(?) AND datetime(?)";
    params = [tz, startDate, endDate];
  } else {
    dateFilter = "datetime(s.created_at, ?) >= datetime('now', '-30 days', ?)";
    params = [tz, tz];
  }

  try {
    const salesDetails = db.prepare(`
      SELECT
        s.ticket_id,
        s.created_at,
        s.product_id,
        p.name as product_name,
        p.type as product_family,
        s.quantity,
        s.sale_price,
        (s.quantity * s.sale_price) as line_total,
        s.total_cost,
        s.payment_method,
        c.first_name || ' ' || c.last_name as customer_name,
        u.username as operator_name
      FROM sales s
      JOIN products p ON s.product_id = p.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN cash_shifts cs ON s.shift_id = cs.id
      LEFT JOIN users u ON cs.user_id = u.id
      WHERE ${dateFilter} AND s.status = 'completed'
      ORDER BY s.created_at ASC
    `).all(...params);

    res.json(salesDetails);
  } catch (error: any) {
    next(error);
  }
});

// Analytics
router.get('/', (req, res, next) => {
  const { period = 'month', startDate, endDate } = req.query;

  // Get configured timezone
  const tzSetting = db.prepare("SELECT value FROM company_settings WHERE key = 'timezone_offset'").get() as { value: string } | undefined;
  const tz = tzSetting?.value || 'localtime';

  let dateFilter = "";
  let params: any[] = [];

  if (startDate && endDate) {
    dateFilter = "datetime(created_at, ?) BETWEEN datetime(?) AND datetime(?)";
    params = [tz, startDate, endDate];
  } else {
    let interval = "'-30 days'";
    if (period === 'day') interval = "'-1 day'";
    if (period === 'week') interval = "'-7 days'";
    dateFilter = `datetime(created_at, ?) >= datetime('now', ${interval}, ?)`;
    params = [tz, tz];
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
      SELECT SUM(b.quantity * b.cost) as cost_value, SUM(b.quantity * p.sale_price) as sale_value
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.quantity > 0
    `).get() as any;

    const totalFixedCostsRow = db.prepare(`SELECT SUM(amount) as total FROM fixed_costs`).get() as any;
    // null (not 0) when nothing is configured yet, so the break-even chart can
    // show an honest "not configured" state instead of a fabricated target.
    const totalFixedCosts = totalFixedCostsRow.total || null;

    // Sale prices are IVA-inclusive (19%, same convention as QuotesView), so
    // gross sales include tax that was never the business's own revenue.
    // Product cost is entered gross too (what was actually paid the
    // supplier, IVA included), so it must be stripped the same way before
    // comparing it against net sales — otherwise a tax-inclusive cost gets
    // subtracted from a tax-exclusive revenue and understates the margin.
    const IVA_RATE = 0.19;
    const grossSalesRevenue = summary.total_revenue || 0;
    const netSalesRevenue = grossSalesRevenue / (1 + IVA_RATE);
    const ivaDebito = grossSalesRevenue - netSalesRevenue;
    const netCost = (summary.total_cost || 0) / (1 + IVA_RATE);
    const netProfit = netSalesRevenue - netCost;
    const netMargin = netSalesRevenue > 0 ? (netProfit / netSalesRevenue) * 100 : 0;

    res.json({
      topProducts,
      categoryAnalysis,
      summary: {
        ...summary,
        ...expensesSummary,
        gross_sales_revenue: grossSalesRevenue,
        iva_debito: ivaDebito,
        net_sales_revenue: netSalesRevenue,
        net_profit: netProfit,
        net_margin: netMargin,
        total_inventory_value: totalInventoryValue.cost_value || 0,
        total_inventory_value_sale: totalInventoryValue.sale_value || 0,
        total_fixed_costs: totalFixedCosts
      },
      inventoryByFamily
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
