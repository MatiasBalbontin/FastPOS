import express from 'express';
import crypto from 'crypto';

declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
    userId?: number;
    username?: string;
    permissions?: string[];
  }
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.session && req.session.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
};

export const requirePermission = (moduleName: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.session && req.session.isAuthenticated) {
      const userPermissions = req.session.permissions || [];
      if (req.session.username === 'admin' || userPermissions.includes(moduleName)) {
        next();
      } else {
        res.status(403).json({ error: 'Permisos insuficientes para acceder a este módulo' });
      }
    } else {
      res.status(401).json({ error: 'No autenticado' });
    }
  };
};

// Same as requirePermission, but grants access if the user has ANY of the
// listed modules. Used where a screen from module A legitimately needs to
// read/create records that belong to module B (e.g. Ventas necesita crear
// clientes al fiar, aunque el operador no tenga acceso a Entidades).
export const requireAnyPermission = (moduleNames: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.session && req.session.isAuthenticated) {
      const userPermissions = req.session.permissions || [];
      if (req.session.username === 'admin' || moduleNames.some(m => userPermissions.includes(m))) {
        next();
      } else {
        res.status(403).json({ error: 'Permisos insuficientes para acceder a este módulo' });
      }
    } else {
      res.status(401).json({ error: 'No autenticado' });
    }
  };
};
