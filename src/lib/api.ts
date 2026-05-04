import { supabase } from './supabase';

let currentTenantId: string | null = null;

export const api = {
  setTenantId(id: string | null) {
    currentTenantId = id;
  },

  _getTenant() {
    if (!currentTenantId) throw new Error('No tenant selected');
    return currentTenantId;
  },

  // --- PRODUCTS ---
  async fetchProducts() {
    const { data: products, error } = await supabase
      .from('products')
      .select('*, batches(quantity, cost, created_at)')
      .eq('tenant_id', this._getTenant());
    
    if (error) throw error;

    return products.map((p: any) => {
      const validBatches = p.batches?.filter((b: any) => b.quantity > 0) || [];
      const total_stock = p.batches?.reduce((sum: number, b: any) => sum + b.quantity, 0) || 0;
      // Sort batches by created_at ascending
      validBatches.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const currentCost = validBatches.length > 0 ? validBatches[0].cost : 0;
      
      return {
        ...p,
        total_stock,
        cost: currentCost
      };
    });
  },

  async createProduct(product: any) {
    const { id, name, type, sale_price, initial_stock, cost } = product;
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('No autenticado');
    
    // Create product
    const { error: pError } = await supabase.from('products').insert({
      id,
      tenant_id: this._getTenant(),
      user_id: user.id,
      name: name.toUpperCase(),
      type: type.toUpperCase(),
      sale_price
    });
    if (pError) throw pError;

    // Create batch if stock > 0
    if (initial_stock > 0) {
      const { error: bError } = await supabase.from('batches').insert({
        product_id: id,
        tenant_id: this._getTenant(),
        user_id: user.id,
        quantity: initial_stock,
        initial_quantity: initial_stock,
        cost: cost || 0
      });
      if (bError) throw bError;
    }
  },

  async updateProduct(id: string, product: any) {
    const { name, type, sale_price, new_stock, cost } = product;
    
    const { error: pError } = await supabase.from('products')
      .update({ name: name.toUpperCase(), type: type.toUpperCase(), sale_price })
      .eq('id', id)
      .eq('tenant_id', this._getTenant());
    if (pError) throw pError;

    if (new_stock !== undefined) {
      // Use the RPC to safely handle FIFO stock adjustment
      const { error: rpcError } = await supabase.rpc('update_product_stock', {
        p_product_id: id,
        p_new_stock: parseInt(new_stock, 10),
        p_cost: cost || 0,
        p_tenant_id: this._getTenant() // User must update RPC to accept this
      });
      if (rpcError) throw rpcError;
    }
  },

  async deleteProduct(id: string) {
    // Check sales first
    const { count } = await supabase.from('sales').select('*', { count: 'exact', head: true })
      .eq('product_id', id)
      .eq('tenant_id', this._getTenant());
    
    if (count && count > 0) {
      throw new Error('No se puede eliminar un producto con historial de ventas. Déjalo con Stock 0.');
    }

    const { error } = await supabase.from('products').delete()
      .eq('id', id)
      .eq('tenant_id', this._getTenant());
    if (error) throw error;
  },

  async importBulkProducts(products: any[]) {
    // Basic implementation: sequential. For production, consider an RPC.
    for (const item of products) {
      try {
        await this.createProduct({
          id: item.id,
          name: item.name,
          type: item.type,
          sale_price: item.sale_price,
          initial_stock: item.initial_stock,
          cost: item.cost
        });
      } catch (e) {
        console.error('Error importing product', item.id, e);
      }
    }
  },

  // --- SALES ---
  async processBulkSales(items: any[], method: string, customer_id?: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase.rpc('process_bulk_sales', {
      p_items: items,
      p_method: method,
      p_customer_id: customer_id || null,
      p_tenant_id: this._getTenant(), // User must update RPC to accept this
      p_user_id: user.id
    });
    if (error) throw error;
    return data;
  },

  // --- HISTORY & VOID ---
  async fetchHistory(startDate?: string, endDate?: string) {
    let salesQuery = supabase.from('sales').select('*, products(name)').not('ticket_id', 'is', null).eq('tenant_id', this._getTenant());
    let paymentsQuery = supabase.from('customer_payments').select('*, customers(first_name, last_name)').eq('tenant_id', this._getTenant());

    if (startDate && endDate) {
      salesQuery = salesQuery.gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`);
      paymentsQuery = paymentsQuery.gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`);
    }

    const [salesRes, paymentsRes] = await Promise.all([salesQuery, paymentsQuery]);
    
    // Group sales by ticket_id
    const ticketsMap = new Map();
    salesRes.data?.forEach(s => {
      if (!ticketsMap.has(s.ticket_id)) {
        ticketsMap.set(s.ticket_id, {
          id: s.ticket_id,
          type: 'sale',
          method: s.payment_method,
          status: s.status,
          created_at: s.created_at,
          total_amount: 0,
          items: []
        });
      }
      const ticket = ticketsMap.get(s.ticket_id);
      ticket.total_amount += (s.quantity * s.sale_price);
      ticket.items.push({
        product_id: s.product_id,
        name: s.products?.name,
        quantity: s.quantity,
        sale_price: s.sale_price
      });
    });

    const tickets = Array.from(ticketsMap.values());
    
    const payments = paymentsRes.data?.map(p => ({
      id: p.id,
      type: 'payment',
      method: p.method,
      status: p.status,
      created_at: p.created_at,
      total_amount: p.amount,
      items: [],
      customer_name: p.customers ? `${p.customers.first_name} ${p.customers.last_name}` : null
    })) || [];

    const combined = [...tickets, ...payments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return combined.slice(0, 100);
  },

  async voidSale(ticket_id: string) {
    const { error } = await supabase.rpc('void_sale', { 
      p_ticket_id: ticket_id,
      p_tenant_id: this._getTenant() // User must update RPC
    });
    if (error) throw error;
  },

  // --- ANALYTICS ---
  async fetchAnalytics(startDate: string, endDate: string) {
    const [salesRes, expensesRes, paymentsRes, productsRes] = await Promise.all([
      supabase.from('sales').select('*, products(name, type)').neq('status', 'voided').eq('tenant_id', this._getTenant()).gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`),
      supabase.from('expenses').select('*').eq('tenant_id', this._getTenant()).gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`),
      supabase.from('customer_payments').select('*').neq('status', 'voided').eq('tenant_id', this._getTenant()).gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`),
      supabase.from('products').select('*, batches(quantity, cost)').eq('tenant_id', this._getTenant())
    ]);

    const sales = salesRes.data || [];
    const expenses = expensesRes.data || [];
    const payments = paymentsRes.data || [];
    const products = productsRes.data || [];

    let total_revenue = 0;
    let total_cost = 0;
    let cash_revenue_sales = 0;
    let card_revenue_sales = 0;
    let receivables_revenue = 0;

    const productsMap = new Map();
    const categoryMap = new Map();

    sales.forEach(s => {
      const rev = s.quantity * s.sale_price;
      total_revenue += rev;
      total_cost += Number(s.total_cost);

      if (s.payment_method === 'cash') cash_revenue_sales += rev;
      if (s.payment_method === 'card') card_revenue_sales += rev;
      if (s.payment_method === 'cuenta_por_cobrar') receivables_revenue += rev;

      const pName = s.products?.name || 'Desc.';
      const pType = s.products?.type || 'Desc.';

      if (!productsMap.has(pName)) productsMap.set(pName, { name: pName, volume: 0, revenue: 0 });
      productsMap.get(pName).volume += s.quantity;
      productsMap.get(pName).revenue += rev;

      if (!categoryMap.has(pType)) categoryMap.set(pType, { type: pType, volume: 0, revenue: 0 });
      categoryMap.get(pType).volume += s.quantity;
      categoryMap.get(pType).revenue += rev;
    });

    let cash_payments = 0;
    let card_payments = 0;
    payments.forEach(p => {
      if (p.method === 'cash') cash_payments += Number(p.amount);
      if (p.method === 'card') card_payments += Number(p.amount);
    });

    let total_expenses = 0;
    let cash_expenses = 0;
    let card_expenses = 0;
    expenses.forEach(e => {
      total_expenses += Number(e.amount);
      if (e.method === 'cash') cash_expenses += Number(e.amount);
      if (e.method === 'card') card_expenses += Number(e.amount);
    });

    const cash_revenue = cash_revenue_sales + cash_payments;
    const card_revenue = card_revenue_sales + card_payments;
    const total_receivables = receivables_revenue - cash_payments - card_payments;

    let total_inventory_value = 0;
    const inventoryByFamilyMap = new Map();

    products.forEach(p => {
      const type = p.type || 'N/A';
      if (!inventoryByFamilyMap.has(type)) inventoryByFamilyMap.set(type, { type, total_stock: 0, total_value: 0 });
      
      p.batches?.forEach((b: any) => {
        if (b.quantity > 0) {
          inventoryByFamilyMap.get(type).total_stock += b.quantity;
          inventoryByFamilyMap.get(type).total_value += (b.quantity * b.cost);
          total_inventory_value += (b.quantity * b.cost);
        }
      });
    });

    const topProducts = Array.from(productsMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const categoryAnalysis = Array.from(categoryMap.values());
    const inventoryByFamily = Array.from(inventoryByFamilyMap.values()).sort((a, b) => b.total_value - a.total_value);

    return {
      topProducts,
      categoryAnalysis,
      summary: {
        total_revenue,
        total_cost,
        total_profit: total_revenue - total_cost,
        cash_revenue_sales,
        card_revenue_sales,
        receivables_revenue,
        cash_revenue,
        card_revenue,
        total_receivables,
        total_expenses,
        cash_expenses,
        card_expenses,
        total_inventory_value
      },
      inventoryByFamily
    };
  },

  // --- EXPENSES ---
  async fetchExpenses() {
    const { data, error } = await supabase.from('expenses').select('*')
      .eq('tenant_id', this._getTenant())
      .order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data;
  },

  async addExpense(expense: any) {
    const { description, amount, method } = expense;
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('No autenticado');

    const { error } = await supabase.from('expenses').insert({
      tenant_id: this._getTenant(),
      user_id: user.id,
      description: description.toUpperCase(),
      amount,
      method
    });
    if (error) throw error;
  },

  // --- CUSTOMERS & RECEIVABLES ---
  async fetchCustomers() {
    const { data, error } = await supabase.from('customers').select('*')
      .eq('tenant_id', this._getTenant())
      .order('first_name', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createCustomer(customer: any) {
    const { rut, first_name, last_name } = customer;
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase.from('customers').insert({
      tenant_id: this._getTenant(),
      user_id: user.id,
      rut,
      first_name: first_name.toUpperCase(),
      last_name: last_name.toUpperCase()
    }).select().single();
    if (error) throw error;
    return data.id;
  },

  async fetchReceivables() {
    // For receivables, we get all customers, their sales (cuenta_por_cobrar) and their payments
    const [customersRes, salesRes, paymentsRes] = await Promise.all([
      supabase.from('customers').select('*').eq('tenant_id', this._getTenant()),
      supabase.from('sales').select('customer_id, quantity, sale_price').eq('tenant_id', this._getTenant()).eq('payment_method', 'cuenta_por_cobrar').eq('status', 'completed'),
      supabase.from('customer_payments').select('customer_id, amount').eq('tenant_id', this._getTenant()).eq('status', 'completed')
    ]);

    const customers = customersRes.data || [];
    const sales = salesRes.data || [];
    const payments = paymentsRes.data || [];

    const result = customers.map(c => {
      const cSales = sales.filter(s => s.customer_id === c.id).reduce((sum, s) => sum + (s.quantity * s.sale_price), 0);
      const cPayments = payments.filter(p => p.customer_id === c.id).reduce((sum, p) => sum + Number(p.amount), 0);
      return {
        ...c,
        total_debt: cSales - cPayments
      };
    }).filter(c => c.total_debt > 0).sort((a, b) => b.total_debt - a.total_debt);

    return result;
  },

  async fetchReceivableDetails(customer_id: number) {
    const [customerRes, salesRes, paymentsRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', customer_id).eq('tenant_id', this._getTenant()).single(),
      supabase.from('sales').select('ticket_id, created_at, quantity, sale_price, status').eq('tenant_id', this._getTenant()).eq('customer_id', customer_id).eq('payment_method', 'cuenta_por_cobrar').eq('status', 'completed'),
      supabase.from('customer_payments').select('id, created_at, amount, method, status').eq('tenant_id', this._getTenant()).eq('customer_id', customer_id)
    ]);

    // Group sales by ticket
    const ticketMap = new Map();
    salesRes.data?.forEach(s => {
      if (!ticketMap.has(s.ticket_id)) ticketMap.set(s.ticket_id, { ticket_id: s.ticket_id, date: s.created_at, amount: 0, type: 'debt', status: s.status });
      ticketMap.get(s.ticket_id).amount += (s.quantity * s.sale_price);
    });

    const debts = Array.from(ticketMap.values());
    const payments = paymentsRes.data?.map(p => ({ ticket_id: p.id, date: p.created_at, amount: p.amount, type: 'payment', method: p.method, status: p.status })) || [];
    const history = [...debts, ...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { customer: customerRes.data, history };
  },

  async payReceivable(customer_id: number, amount: number, method: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('No autenticado');

    const { error } = await supabase.from('customer_payments').insert({
      tenant_id: this._getTenant(),
      customer_id,
      user_id: user.id,
      amount,
      method,
      status: 'completed'
    });
    if (error) throw error;
  },

  async voidPayment(id: string) {
    const { error } = await supabase.from('customer_payments').update({ status: 'voided' })
      .eq('id', id)
      .eq('tenant_id', this._getTenant());
    if (error) throw error;
  }
};
