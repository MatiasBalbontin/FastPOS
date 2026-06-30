import express from 'express';
import { loginLimiter } from '../middleware/rateLimiter';
import { db } from '../db/index';
import { hashPassword } from '../middleware/auth';

const router = express.Router();

router.post('/login', loginLimiter, (req, res) => {
  const { username = 'admin', password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'La contraseña es requerida' });
  }

  const hashed = hashPassword(password);
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username.toLowerCase().trim()) as any;
    
    if (user && user.password === hashed) {
      req.session.isAuthenticated = true;
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.permissions = JSON.parse(user.permissions || '[]');
      
      res.json({ 
        success: true, 
        username: user.username, 
        permissions: req.session.permissions 
      });
    } else {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor durante la autenticación' });
  }
});

router.get('/session', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    res.json({ 
      authenticated: true, 
      username: req.session.username,
      permissions: req.session.permissions || []
    });
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
