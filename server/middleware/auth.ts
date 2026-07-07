import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
    userId?: number;
    username?: string;
    permissions?: string[];
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return bcrypt.compareSync(password, storedHash);
  }
  // Fallback to SHA-256 comparison for legacy passwords
  const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
  return sha256Hash === storedHash;
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
