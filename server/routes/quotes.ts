import express from 'express';
import { db } from '../db/index';
import { AppError } from '../middleware/errorHandler';
import { requirePermission } from '../middleware/auth';

const router = express.Router();

router.use(requirePermission('quotes'));

const REQUIRED_COMPANY_FIELDS = ['company_name', 'company_rut', 'company_address', 'company_bank_details'];

// Every fresh install starts with empty company_settings (see server.ts): a
// quote PDF issued with a blank razón social/RUT/cuenta bancaria is useless
// to the client, so the first quote can't be created until these are filled
// in from Configuración > Datos de Empresa.
function assertCompanyDataConfigured() {
  const rows = db.prepare(
    `SELECT key, value FROM company_settings WHERE key IN (${REQUIRED_COMPANY_FIELDS.map(() => '?').join(',')})`
  ).all(...REQUIRED_COMPANY_FIELDS) as { key: string; value: string }[];

  const configured = new Map(rows.map(r => [r.key, r.value]));
  const missing = REQUIRED_COMPANY_FIELDS.some(field => !configured.get(field)?.trim());

  if (missing) {
    throw new AppError(
      'Complete los datos de su empresa (Razón Social, RUT, Dirección y Datos Bancarios) en Configuración antes de emitir cotizaciones.',
      400
    );
  }
}

// Get Quotes
router.get('/', (req, res, next) => {
  try {
    const quotes = db.prepare(`
      SELECT q.*, 
             COALESCE(SUM(qi.quantity * qi.sale_price), 0) as total_amount
      FROM quotes q
      LEFT JOIN quote_items qi ON q.id = qi.quote_id
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `).all();
    res.json(quotes);
  } catch (error: any) {
    next(error);
  }
});

// Get single Quote
router.get('/:id', (req, res, next) => {
  const { id } = req.params;
  try {
    const quote = db.prepare(`
      SELECT q.*, c.address as client_address
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = ?
    `).get(id) as any;
    if (!quote) return next(new AppError('Cotización no encontrada', 404));
    const items = db.prepare("SELECT * FROM quote_items WHERE quote_id = ?").all(id);
    res.json({ ...quote, items });
  } catch (error: any) {
    next(error);
  }
});

// Create Quote
router.post('/', (req, res, next) => {
  const {
    customer_id,
    client_name,
    client_rut,
    client_contact,
    client_phone,
    client_email,
    condition,
    validity_days,
    glosa,
    items
  } = req.body;

  try {
    assertCompanyDataConfigured();
    if (!client_name) {
      throw new AppError('Nombre del cliente es obligatorio', 400);
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Debe agregar al menos un item a la cotización', 400);
    }

    const transaction = db.transaction(() => {
      const quoteResult = db.prepare(`
        INSERT INTO quotes (
          customer_id, client_name, client_rut, client_contact, 
          client_phone, client_email, condition, validity_days, glosa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer_id || null,
        client_name.toUpperCase(),
        client_rut || null,
        client_contact || null,
        client_phone || null,
        client_email || null,
        condition || 'Contado - CLP',
        parseInt(validity_days, 10) || 30,
        glosa || null
      );

      const quoteId = quoteResult.lastInsertRowid;
      const insertItem = db.prepare(`
        INSERT INTO quote_items (quote_id, product_id, name, quantity, unit, sale_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          quoteId,
          item.product_id || null,
          item.name.toUpperCase(),
          parseFloat(item.quantity) || 0,
          item.unit || 'UNID',
          parseFloat(item.sale_price) || 0
        );
      }
      return quoteId;
    });

    const quoteId = transaction();
    res.json({ success: true, id: quoteId });
  } catch (error: any) {
    next(error);
  }
});

// Update Quote
router.put('/:id', (req, res, next) => {
  const { id } = req.params;
  const {
    customer_id,
    client_name,
    client_rut,
    client_contact,
    client_phone,
    client_email,
    condition,
    validity_days,
    glosa,
    items
  } = req.body;

  try {
    if (!client_name) {
      throw new AppError('Nombre del cliente es obligatorio', 400);
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Debe agregar al menos un item a la cotización', 400);
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE quotes SET
          customer_id = ?,
          client_name = ?,
          client_rut = ?,
          client_contact = ?,
          client_phone = ?,
          client_email = ?,
          condition = ?,
          validity_days = ?,
          glosa = ?
        WHERE id = ?
      `).run(
        customer_id || null,
        client_name.toUpperCase(),
        client_rut || null,
        client_contact || null,
        client_phone || null,
        client_email || null,
        condition || 'Contado - CLP',
        parseInt(validity_days, 10) || 30,
        glosa || null,
        id
      );

      db.prepare("DELETE FROM quote_items WHERE quote_id = ?").run(id);

      const insertItem = db.prepare(`
        INSERT INTO quote_items (quote_id, product_id, name, quantity, unit, sale_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          id,
          item.product_id || null,
          item.name.toUpperCase(),
          parseFloat(item.quantity) || 0,
          item.unit || 'UNID',
          parseFloat(item.sale_price) || 0
        );
      }
    });

    transaction();
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

// Delete Quote
router.delete('/:id', (req, res, next) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM quotes WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

export default router;
