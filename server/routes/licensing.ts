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
 * Recalcula la firma HMAC-SHA256 localmente para verificar offline.
 * Debe usar el mismo formato de payload que el servidor de licencias usa
 * en la función firmarActivacion() de servidor-licencias/index.js.
 * Si cambias el formato aquí, cámbialo también en el servidor.
 */
function verificarFirmaLocal(data: {
  licenseKey: string;
  email: string;
  deviceId: string;
  signature: string;
}): boolean {
  // HMAC_SECRET debe ser la misma clave que el servidor usa para firmar.
  // Se lee de FastPOS/.env → variable HMAC_SECRET.
  const secret = process.env.HMAC_SECRET;
  if (!secret) {
    console.error('[LICENSE] HMAC_SECRET no configurado en .env — no se puede verificar offline');
    return false;
  }

  const payload = `${data.licenseKey}:${data.email}:${data.deviceId}:active`;
  const firmaEsperada = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // timingSafeEqual evita ataques de timing sobre la comparación
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
 * La validación offline se basa solo en la firma HMAC —
 * no requiere conexión a internet.
 */
function verificarLicenciaLocal(): { licensed: boolean; email?: string; key?: string; plan?: string } {
  if (!fs.existsSync(licensePath)) {
    return { licensed: false };
  }

  try {
    const data = JSON.parse(fs.readFileSync(licensePath, 'utf-8'));

    // Campos mínimos que debe tener un archivo .license válido
    if (!data.email || !data.licenseKey || !data.deviceId || !data.signature) {
      return { licensed: false };
    }

    // Verificar que la firma no fue manipulada
    const firmaValida = verificarFirmaLocal({
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


export default router;
