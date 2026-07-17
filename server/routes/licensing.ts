/**
 * RUTAS DE LICENCIAMIENTO — FastPOS (cliente local)
 * ===================================================
 * Este módulo corre DENTRO del instalador en el PC del cliente.
 *
 * FLUJO DE ACTIVACIÓN (primera vez, requiere internet):
 *   1. Usuario ingresa email + clave en la pantalla de activación
 *   2. Se genera un deviceId único y estable para este equipo
 *   3. Se llama al servidor de licencias en la nube (LICENSE_SERVER_URL)
 *   4. El servidor valida la clave contra Supabase y devuelve una firma HMAC
 *   5. La firma se guarda en el archivo .license junto a los datos
 *
 * FLUJO OFFLINE (arranques posteriores, sin internet):
 *   1. Se lee el archivo .license
 *   2. Se recalcula la firma HMAC localmente con HMAC_SECRET
 *   3. Si coincide → licencia válida, FastPOS arranca
 *   4. Si no coincide → el archivo fue manipulado, se bloquea
 *
 * Variables de entorno requeridas en FastPOS/.env:
 *   LICENSE_SERVER_URL  → URL del servidor en Vercel
 *   HMAC_SECRET         → misma clave que en el servidor (para verificar offline)
 */

import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ruta del archivo de licencia guardado localmente en el equipo del cliente
const licensePath = path.join(__dirname, '..', '..', '.license');

// Ruta del archivo que persiste el deviceId entre reinicios
// (se genera una sola vez y queda guardado)
const deviceIdPath = path.join(__dirname, '..', '..', '.deviceid');


// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera o recupera un identificador único y estable para este equipo.
 * Combina datos del sistema operativo con un UUID persistido para
 * que sobreviva reinicios pero sea único por máquina.
 */
function obtenerDeviceId(): string {
  if (fs.existsSync(deviceIdPath)) {
    return fs.readFileSync(deviceIdPath, 'utf-8').trim();
  }

  // Construir un ID a partir de características del equipo
  const baseInfo = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || 'cpu'}`;
  const hash = crypto.createHash('sha256').update(baseInfo).digest('hex').substring(0, 32);

  fs.writeFileSync(deviceIdPath, hash, 'utf-8');
  return hash;
}

/**
 * Recalcula la firma HMAC-SHA256 localmente para verificar offline (modelo
 * legacy por clave de licencia). Debe coincidir con firmarActivacion() en
 * servidor-licencias/index.js.
 */
function verificarFirmaLocalLegacy(data: {
  licenseKey: string;
  email: string;
  deviceId: string;
  signature: string;
}): boolean {
  const secret = process.env.HMAC_SECRET;
  if (!secret) {
    console.error('[LICENSE] HMAC_SECRET no configurado en .env — no se puede verificar offline');
    return false;
  }

  const payload = `${data.licenseKey}:${data.email}:${data.deviceId}:active`;
  const firmaEsperada = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(firmaEsperada, 'hex'),
      Buffer.from(data.signature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Recalcula la firma HMAC-SHA256 localmente para verificar offline (modelo
 * nuevo por cuenta de empresa). Debe coincidir con firmarActivacionEmpresa()
 * en servidor-licencias/index.js.
 */
function verificarFirmaLocalEmpresa(data: {
  companyId: string | number;
  deviceId: string;
  signature: string;
}): boolean {
  const secret = process.env.HMAC_SECRET;
  if (!secret) {
    console.error('[LICENSE] HMAC_SECRET no configurado en .env — no se puede verificar offline');
    return false;
  }

  const payload = `${data.companyId}:${data.deviceId}:active`;
  const firmaEsperada = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(firmaEsperada, 'hex'),
      Buffer.from(data.signature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Lee y valida el archivo .license local.
 * La validación offline se basa solo en la firma HMAC — no requiere internet.
 * Soporta dos formatos de certificado: el legacy (licenseKey) y el nuevo
 * (companyId) — se distingue por qué campos trae el JSON guardado.
 */
function verificarLicenciaLocal(): { licensed: boolean; email?: string; key?: string; companyId?: string; plan?: string } {
  if (!fs.existsSync(licensePath)) {
    return { licensed: false };
  }

  try {
    const data = JSON.parse(fs.readFileSync(licensePath, 'utf-8'));

    if (!data.deviceId || !data.signature) {
      return { licensed: false };
    }

    // Certificado nuevo: por cuenta de empresa
    if (data.companyId) {
      const firmaValida = verificarFirmaLocalEmpresa({
        companyId: data.companyId,
        deviceId:  data.deviceId,
        signature: data.signature
      });
      if (!firmaValida) {
        console.warn('[LICENSE] Firma inválida — el archivo .license fue modificado');
        return { licensed: false };
      }
      return { licensed: true, email: data.email, companyId: data.companyId, plan: data.plan };
    }

    // Certificado legacy: por clave de licencia
    if (!data.email || !data.licenseKey) {
      return { licensed: false };
    }
    const firmaValida = verificarFirmaLocalLegacy({
      licenseKey: data.licenseKey,
      email:      data.email,
      deviceId:   data.deviceId,
      signature:  data.signature
    });

    if (!firmaValida) {
      console.warn('[LICENSE] Firma inválida — el archivo .license fue modificado');
      return { licensed: false };
    }

    return { licensed: true, email: data.email, key: data.licenseKey, plan: data.plan };

  } catch (e) {
    console.error('[LICENSE] Error al leer .license:', e);
    return { licensed: false };
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: GET /api/license/status
// Verifica si FastPOS está activado en este equipo (sin internet)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const status = verificarLicenciaLocal();
  res.json(status);
});


// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: POST /api/license/activate
// Activa FastPOS por primera vez. Requiere internet para llamar al servidor.
// Body esperado: { email: string, licenseKey: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/activate', async (req, res) => {
  const { email, licenseKey } = req.body;

  if (!email || !licenseKey) {
    return res.status(400).json({ error: 'El correo y la clave de licencia son requeridos.' });
  }

  // URL del servidor de licencias en Vercel.
  // Se configura en FastPOS/.env → variable LICENSE_SERVER_URL.
  // Ejemplo: https://fastpos-licenses.vercel.app
  const serverUrl = process.env.LICENSE_SERVER_URL;
  if (!serverUrl) {
    return res.status(500).json({ error: 'El servidor de licencias no está configurado. Contacta soporte.' });
  }

  const deviceId = obtenerDeviceId();

  try {
    // Llamar al servidor de licencias en la nube para validar la clave
    const response = await fetch(`${serverUrl}/api/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:      email.trim().toLowerCase(),
        licenseKey: licenseKey.trim().toUpperCase(),
        deviceId:   deviceId
      }),
      signal: AbortSignal.timeout(15000)  // 15 segundos máximo de espera
    });

    const resultado = await response.json() as any;

    if (!response.ok) {
      // Pasar el mensaje de error del servidor directamente al frontend
      return res.status(response.status).json({ error: resultado.error || 'Error al activar la licencia.' });
    }

    // Guardar el certificado de activación en el archivo .license local
    // Este archivo es lo que FastPOS lee en cada arranque para verificar offline
    fs.writeFileSync(licensePath, JSON.stringify(resultado.license, null, 2), 'utf-8');

    res.json({ success: true, message: 'FastPOS activado correctamente.', plan: resultado.license.plan });

  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'No se pudo conectar al servidor de activación. Verifica tu conexión a internet e inténtalo de nuevo.'
      });
    }
    console.error('[LICENSE] Error al activar:', err);
    res.status(500).json({ error: 'Error inesperado durante la activación.' });
  }
});



// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: POST /api/license/login
// Reemplaza a /activate para el modelo de cuentas de empresa (email +
// contraseña en vez de email + clave). Requiere internet la primera vez;
// después el certificado local permite abrir sin conexión, igual que hoy.
// Body esperado: { email: string, password: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'El correo y la contraseña son requeridos.' });
  }

  const serverUrl = process.env.LICENSE_SERVER_URL;
  if (!serverUrl) {
    return res.status(500).json({ error: 'El servidor de licencias no está configurado. Contacta soporte.' });
  }

  const deviceId = obtenerDeviceId();

  try {
    const response = await fetch(`${serverUrl}/api/company/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:    email.trim().toLowerCase(),
        password: password,
        deviceId: deviceId
      }),
      signal: AbortSignal.timeout(15000)
    });

    const resultado = await response.json() as any;

    if (!response.ok) {
      return res.status(response.status).json({ error: resultado.error || 'Error al iniciar sesión.' });
    }

    // El plan Offline devuelve un certificado para guardar localmente.
    // El plan Online (app web, fuera de este instalador) no pasa por acá.
    if (resultado.mode === 'offline' && resultado.license) {
      fs.writeFileSync(licensePath, JSON.stringify(resultado.license, null, 2), 'utf-8');
    }

    res.json({ success: true, message: 'Sesión iniciada correctamente.', plan: resultado.license?.plan });

  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'No se pudo conectar al servidor de activación. Verifica tu conexión a internet e inténtalo de nuevo.'
      });
    }
    console.error('[LICENSE] Error al iniciar sesión:', err);
    res.status(500).json({ error: 'Error inesperado al iniciar sesión.' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: POST /api/license/forgot-password
// Reenvía al servidor de licencias — pide un código de 6 dígitos por email.
// Body esperado: { email: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'El correo es requerido.' });
  }

  const serverUrl = process.env.LICENSE_SERVER_URL;
  if (!serverUrl) {
    return res.status(500).json({ error: 'El servidor de licencias no está configurado. Contacta soporte.' });
  }

  try {
    const response = await fetch(`${serverUrl}/api/company/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
      signal: AbortSignal.timeout(15000)
    });
    const resultado = await response.json() as any;
    res.status(response.status).json(resultado);
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'No se pudo conectar al servidor. Verifica tu conexión a internet.' });
    }
    console.error('[LICENSE] Error al pedir código de recuperación:', err);
    res.status(500).json({ error: 'Error inesperado.' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT: POST /api/license/reset-password
// Reenvía al servidor de licencias — canjea el código por una contraseña nueva.
// Body esperado: { email: string, code: string, newPassword: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'El correo, el código y la nueva contraseña son requeridos.' });
  }

  const serverUrl = process.env.LICENSE_SERVER_URL;
  if (!serverUrl) {
    return res.status(500).json({ error: 'El servidor de licencias no está configurado. Contacta soporte.' });
  }

  try {
    const response = await fetch(`${serverUrl}/api/company/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code, newPassword }),
      signal: AbortSignal.timeout(15000)
    });
    const resultado = await response.json() as any;
    res.status(response.status).json(resultado);
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'No se pudo conectar al servidor. Verifica tu conexión a internet.' });
    }
    console.error('[LICENSE] Error al restablecer contraseña:', err);
    res.status(500).json({ error: 'Error inesperado.' });
  }
});


export default router;
