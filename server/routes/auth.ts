import express from 'express';
import { loginLimiter } from '../middleware/rateLimiter';
import { db } from '../db/index';
import { hashPassword, verifyPassword } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

router.post('/login', loginLimiter, (req, res) => {
  const { username = 'admin', password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'La contraseña es requerida' });
  }
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username.toLowerCase().trim()) as any;
    
    if (user && verifyPassword(password, user.password)) {
      // Automatic migration: if password hash is SHA-256 (not starting with bcrypt pattern), update to bcrypt
      const isBcrypt = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$');
      if (!isBcrypt) {
        const newBcryptHash = hashPassword(password);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newBcryptHash, user.id);
      }

      // Delete CONTRASEÑA_INICIAL.txt if it exists
      try {
        const passwordFile = path.join(__dirname, '..', '..', 'CONTRASEÑA_INICIAL.txt');
        if (fs.existsSync(passwordFile)) {
          fs.unlinkSync(passwordFile);
        }
      } catch (e) {
        console.error("Error al eliminar CONTRASEÑA_INICIAL.txt:", e);
      }

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
