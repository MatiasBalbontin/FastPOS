import express from 'express';
import { db } from '../db/index';
import { validateBody, EntitySchema } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import { requirePermission, requireAnyPermission } from '../middleware/auth';

const router = express.Router();

// Ventas necesita poder listar/crear clientes al vender al fiado, y Cotizaciones
// necesita listarlos para asociar un cliente a la cotización, aunque el
// operador no tenga acceso al módulo de Entidades; editar/eliminar sí queda
// restringido a quien administra la cartera de clientes.
const readWritePermission = requireAnyPermission(['entities', 'fiar', 'quotes']);

// Get customers
router.get('/', readWritePermission, (req, res, next) => {
  const { type } = req.query;
  try {
    let query = 'SELECT * FROM customers';
    const params: any[] = [];
    if (type) {
      query += " WHERE type = ? OR type = 'ambos'";
      params.push(type);
    }
    query += ' ORDER BY first_name ASC';
    const customers = db.prepare(query).all(...params);
    res.json(customers);
  } catch (error: any) {
    next(error);
  }
});

// Create customer
router.post('/', readWritePermission, validateBody(EntitySchema), (req, res, next) => {
  const { rut, first_name, last_name, type, address, contact, phone, email } = req.body;
  try {
    if (!first_name) throw new AppError("Nombre / Razón Social es obligatorio", 400);
    const result = db.prepare(`
      INSERT INTO customers (rut, first_name, last_name, type, address, contact, phone, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rut || null,
      first_name.toUpperCase(),
      (last_name || '').toUpperCase(),
      type || 'cliente',
      address || '',
      contact || '',
      phone || '',
      email || ''
    );
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      next(new AppError('Ya existe un registro con este RUT o Razón Social', 400));
    } else {
      next(error);
    }
  }
});

// Update customer
router.put('/:id', requirePermission('entities'), validateBody(EntitySchema), (req, res, next) => {
  const { id } = req.params;
  const { rut, first_name, last_name, type, address, contact, phone, email } = req.body;
  try {
    if (!first_name) throw new AppError("Nombre / Razón Social es obligatorio", 400);
    db.prepare(`
      UPDATE customers SET
        rut = ?,
        first_name = ?,
        last_name = ?,
        type = ?,
        address = ?,
        contact = ?,
        phone = ?,
        email = ?
      WHERE id = ?
    `).run(
      rut || null,
      first_name.toUpperCase(),
      (last_name || '').toUpperCase(),
      type || 'cliente',
      address || '',
      contact || '',
      phone || '',
      email || '',
      id
    );
    res.json({ success: true });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      next(new AppError('Ya existe un registro con este RUT', 400));
    } else {
      next(error);
    }
  }
});

// Delete customer
router.delete('/:id', requirePermission('entities'), (req, res, next) => {
  const { id } = req.params;
  try {
    const salesCheck = db.prepare('SELECT COUNT(*) as count FROM sales WHERE customer_id = ?').get(id) as { count: number };
    const paymentsCheck = db.prepare('SELECT COUNT(*) as count FROM customer_payments WHERE customer_id = ?').get(id) as { count: number };
    if (salesCheck.count > 0 || paymentsCheck.count > 0) {
      throw new AppError('No se puede eliminar esta entidad porque tiene transacciones asociadas.', 400);
    }
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

export default router;
