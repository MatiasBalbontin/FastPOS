import { describe, it, expect } from 'vitest';
import { 
  validateRut, 
  ProductSchema, 
  SaleSchema, 
  SaleBulkSchema, 
  EntitySchema, 
  ExpenseSchema, 
  ProductUpdateSchema 
} from '../server/middleware/validation';

describe('RUT Algorithm Validation', () => {
  it('should validate correct Chilean RUT formats', () => {
    expect(validateRut('19.789.430-K')).toBe(true);
    expect(validateRut('19789430K')).toBe(true);
    expect(validateRut('19789430-k')).toBe(true);
    expect(validateRut('76.794.328-8')).toBe(true);
    expect(validateRut('76794328-8')).toBe(true);
  });

  it('should invalidate incorrect Chilean RUTs', () => {
    expect(validateRut('19.789.430-5')).toBe(false);
    expect(validateRut('1234')).toBe(false);
    expect(validateRut('76.794.328-K')).toBe(false);
  });
});

describe('Product Schema Validation', () => {
  it('should accept valid product data', () => {
    const valid = {
      name: 'TEST PRODUCT',
      type: 'TEST CATEGORY',
      sale_price: 1500,
      initial_stock: 10,
      cost: 800
    };
    const parsed = ProductSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('should reject non-positive sale price', () => {
    const invalid = {
      name: 'TEST PRODUCT',
      type: 'TEST CATEGORY',
      sale_price: 0
    };
    const parsed = ProductSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe('Sale and SaleBulk Schema Validation', () => {
  it('should accept valid single sale items', () => {
    const valid = {
      product_id: 'P1',
      quantity: 5,
      payment_method: 'cash'
    };
    const parsed = SaleSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('should accept valid bulk sales', () => {
    const valid = {
      items: [
        { product_id: 'P1', quantity: 2 },
        { product_id: 'P2', quantity: 1 }
      ],
      method: 'card',
      customer_id: 12
    };
    const parsed = SaleBulkSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});

describe('Entity Schema Validation', () => {
  it('should accept valid entity information', () => {
    const valid = {
      first_name: 'JUAN PEREZ',
      type: 'cliente',
      rut: '19.789.430-K',
      address: 'SANTIAGO'
    };
    const parsed = EntitySchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('should reject invalid RUT validation inside Entity', () => {
    const invalid = {
      first_name: 'JUAN PEREZ',
      type: 'cliente',
      rut: '12.345.678-K' // Invalid RUT
    };
    const parsed = EntitySchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe('Expense and ProductUpdate Validation', () => {
  it('should validate expense schema constraints', () => {
    const valid = {
      description: 'Luz local',
      amount: 45000,
      method: 'cash'
    };
    const parsed = ExpenseSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('should validate product updates constraints', () => {
    const valid = {
      name: 'NEW NAME',
      cost: 500
    };
    const parsed = ProductUpdateSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});
