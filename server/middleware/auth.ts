import express from 'express';

export const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.session && req.session.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: 'No autenticado' });
  }
};
