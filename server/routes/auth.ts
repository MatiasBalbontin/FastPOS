import express from 'express';
import { loginLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
  if (password === adminPassword) {
    req.session.isAuthenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

router.get('/session', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'No se pudo cerrar la sesión' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

export default router;
