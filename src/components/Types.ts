export interface Product {
  id: string;
  name: string;
  type: string;
  sale_price: number;
  total_stock: number;
  has_zero_cost: boolean;
  cost?: number;
  active: number;
}

export interface Analytics {
  topProducts: { name: string; volume: number; revenue: number }[];
  categoryAnalysis: { type: string; volume: number; revenue: number }[];
  summary: {
    total_revenue: number; total_cost: number; total_profit: number;
    collected_revenue: number; collected_cost: number;
    receivables_revenue: number; receivables_cost: number;
    cash_revenue: number; card_revenue: number;
    total_expenses: number; cash_expenses: number; card_expenses: number;
    gross_sales_revenue: number; iva_debito: number; net_sales_revenue: number;
    net_profit: number; net_margin: number;
    total_inventory_value: number; total_inventory_value_sale: number;
    total_receivables: number;
    total_fixed_costs: number | null;
  };
  inventoryByFamily: { type: string; total_stock: number; total_value: number }[];
}
