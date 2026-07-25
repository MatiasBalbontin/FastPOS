import express from 'express';
import { db } from '../db/index';
import { hashPassword, requirePermission } from '../middleware/auth';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import { logAudit } from '../db/audit';

const router = express.Router();

// Enforce configuration permission for all user management endpoints
router.use(requirePermission('configuration'));

const isAdmin = (req: express.Request) => req.session.username === 'admin';

const CreateUserSchema = z.object({
  username: z.string().min(3).max(50).toLowerCase().trim(),
  password: z.string().min(4),
  permissions: z.array(z.string())
});

const UpdateUserSchema = z.object({
  permissions: z.array(z.string()).optional(),
  password: z.string().min(4).optional(),
  active: z.number().int().min(0).max(1).optional()
});

// List users. Admin sees everyone; anyone else only sees their own account —
// permissions management is an admin-exclusive capability.
router.get('/', (req, res, next) => {
  try {
    const rows = isAdmin(req)
      ? db.prepare('SELECT id, username, permissions, active FROM users ORDER BY id ASC').all() as any[]
      : db.prepare('SELECT id, username, permissions, active FROM users WHERE id = ?').all(req.session.userId) as any[];

    const formatted = rows.map(u => ({
      ...u,
      permissions: JSON.parse(u.permissions || '[]')
    }));
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// Create user — admin only, since it necessarily assigns permissions.
router.post('/', validateBody(CreateUserSchema), (req, res, next) => {
  if (!isAdmin(req)) {
    return next(new AppError('Solo el administrador puede crear operadores', 403));
  }

  const { username, password, permissions } = req.body;
  try {
    const check = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (check) {
      return next(new AppError('El nombre de usuario ya está registrado', 400));
    }

    const hashed = hashPassword(password);
    const serializedPermissions = JSON.stringify(permissions);

    db.prepare('INSERT INTO users (username, password, password_plain, permissions) VALUES (?, ?, ?, ?)')
      .run(username, hashed, password, serializedPermissions);

    logAudit(req.session.userId, req.session.username, 'CREATE_USER', { target_username: username, permissions });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Update user
router.put('/:id', validateBody(UpdateUserSchema), (req, res, next) => {
  const { id } = req.params;
  const { permissions, password, active } = req.body;

  try {
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as { id: number; username: string } | undefined;
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    const admin = isAdmin(req);

    if (!admin) {
      // Non-admins may only touch their own account, and only their own password.
      if (user.id !== req.session.userId) {
        return next(new AppError('Solo puede modificar su propia cuenta', 403));
      }
      if (permissions !== undefined || active !== undefined) {
        return next(new AppError('Solo el administrador puede modificar permisos o el estado de la cuenta', 403));
      }
    }

    // Protect master admin account from modifications that strip config permissions or disable it
    if (user.username === 'admin') {
      if (active === 0) {
        return next(new AppError('No se puede desactivar al usuario administrador principal', 400));
      }
      if (permissions && !permissions.includes('configuration')) {
        return next(new AppError('El administrador principal debe conservar el permiso de configuración', 400));
      }
    }

    const transaction = db.transaction(() => {
      if (active !== undefined) {
        db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active, id);
      }
      if (permissions !== undefined) {
        db.prepare('UPDATE users SET permissions = ? WHERE id = ?').run(JSON.stringify(permissions), id);
      }
      if (password) {
        const hashed = hashPassword(password);
        db.prepare('UPDATE users SET password = ?, password_plain = ? WHERE id = ?').run(hashed, password, id);
      }
    });

    transaction();

    logAudit(req.session.userId, req.session.username, 'UPDATE_USER', {
      target_username: user.username,
      permissionsChanged: permissions !== undefined,
      passwordChanged: !!password,
      activeChanged: active !== undefined ? (active === 1 ? 'activado' : 'desactivado') : undefined
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Reveal the plaintext password — admin only. Returns null if the account's
// password predates the plaintext column (only the irreversible hash exists);
// the admin must reset it to be able to view it going forward.
router.get('/:id/reveal-password', (req, res, next) => {
  if (!isAdmin(req)) {
    return next(new AppError('Solo el administrador puede ver contraseñas', 403));
  }

  const { id } = req.params;
  try {
    const user = db.prepare('SELECT username, password_plain FROM users WHERE id = ?').get(id) as { username: string; password_plain: string | null } | undefined;
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    logAudit(req.session.userId, req.session.username, 'VIEW_PASSWORD', { target_username: user.username });

    res.json({ password: user.password_plain });
  } catch (err) {
    next(err);
  }
});

// Delete user — admin only.
router.delete('/:id', (req, res, next) => {
  if (!isAdmin(req)) {
    return next(new AppError('Solo el administrador puede eliminar operadores', 403));
  }

  const { id } = req.params;
  try {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as { username: string } | undefined;
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    if (user.username === 'admin') {
      return next(new AppError('No se puede eliminar al usuario administrador principal', 400));
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    logAudit(req.session.userId, req.session.username, 'DELETE_USER', { target_username: user.username });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
