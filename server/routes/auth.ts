import express from 'express';
import { loginLimiter } from '../middleware/rateLimiter';
import { db } from '../db/index';
import { hashPassword } from '../middleware/auth';
import { logAudit } from '../db/audit';

const router = express.Router();

router.post('/login', loginLimiter, (req, res) => {
  const { username = 'admin', password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'La contraseña es requerida' });
  }

  const hashed = hashPassword(password);
  const cleanUsername = String(username).toLowerCase().trim();
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(cleanUsername) as any;
    
    if (user && user.password === hashed) {
      req.session.isAuthenticated = true;
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.permissions = JSON.parse(user.permissions || '[]');
      
      logAudit(user.id, user.username, 'LOGIN_SUCCESS');
      
      res.json({ 
        success: true, 
        username: user.username, 
        permissions: req.session.permissions 
      });
    } else {
      logAudit(null, cleanUsername, 'LOGIN_FAILURE', { reason: 'Credenciales inválidas' });
      res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
  } catch (err) {
    logAudit(null, cleanUsername, 'LOGIN_FAILURE', { reason: 'Error de servidor' });
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
  const userId = req.session.userId;
  const username = req.session.username;
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'No se pudo cerrar la sesión' });
    }
    logAudit(userId, username, 'LOGOUT');
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

export default router;
