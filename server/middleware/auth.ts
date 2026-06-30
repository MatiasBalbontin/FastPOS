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
