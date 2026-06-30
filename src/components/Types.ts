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
    total_inventory_value: number;
    total_receivables: number;
    total_fixed_costs: number;
  };
  inventoryByFamily: { type: string; total_stock: number; total_value: number }[];
}
