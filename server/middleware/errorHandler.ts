import express from 'express';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number, details?: any, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Algo salió mal en el servidor';

  console.error('Error:', err);

  if (process.env.NODE_ENV === 'production') {
    if (err.isOperational) {
      return res.status(statusCode).json({ error: message });
    } else {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  res.status(statusCode).json({
    error: message,
    stack: err.stack,
    details: err.details || null
  });
};
