import express from 'express';
import { z, ZodError } from 'zod';

export const validateRut = (rut: string) => {
  const clean = rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  if (!/^[0-9]+[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const dvr = 11 - (sum % 11);
  const dvExpected = dvr === 11 ? '0' : dvr === 10 ? 'K' : String(dvr);
  return dv === dvExpected;
};

export const ProductSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.string().min(1), // category
  sale_price: z.number().gt(0),
  initial_stock: z.union([z.number(), z.string()]).optional(),
  cost: z.union([z.number(), z.string()]).optional()
});

export const SaleSchema = z.object({
  product_id: z.union([z.string(), z.number()]),
  quantity: z.number().gt(0),
  payment_method: z.enum(['cash', 'card', 'cuenta_por_cobrar', 'receivable']).optional()
});

export const SaleBulkSchema = z.object({
  items: z.array(z.object({
    product_id: z.union([z.string(), z.number()]),
    quantity: z.number().gt(0)
  })),
  method: z.enum(['cash', 'card', 'cuenta_por_cobrar', 'receivable']).optional(),
  customer_id: z.union([z.string(), z.number()]).optional().nullable()
});

export const EntitySchema = z.object({
  rut: z.string().refine(val => !val || validateRut(val), { message: 'RUT inválido' }).optional().nullable(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  type: z.enum(['cliente', 'proveedor', 'ambos']),
  address: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional()
});

export const ExpenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().gt(0),
  method: z.string().min(1)
});

export const ProductUpdateSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  sale_price: z.number().gt(0).optional(),
  cost: z.number().nonnegative().optional(),
  new_stock: z.number().int().nonnegative().optional()
});

export const validateBody = (schema: z.ZodSchema) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Datos inválidos', details: error.issues });
      }
      next(error);
    }
  };
};
