import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // Limit each IP to 200 requests per windowMs
  message: { error: 'Demasiadas peticiones desde esta IP, por favor intente de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: { error: 'Demasiados intentos de inicio de sesión, por favor intente de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
