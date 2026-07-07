/**
 * Standalone Licensing Server for FastPOS
 * 
 * Este archivo contiene una implementación de ejemplo lista para ser desplegada
 * en plataformas en la nube (Vercel, Render, Heroku) con Node.js y SQLite/Postgres.
 * 
 * Funciones principales:
 * 1. Generar licencias cuando la pasarela de pagos (Flow/Stripe) confirme la transacción.
 * 2. Validar y registrar activaciones desde los clientes de FastPOS.
 */

const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// Base de datos simulada en memoria (reemplazar con SQLite o PostgreSQL en producción)
const activeLicenses = new Map(); // key -> licenseData

// Clave secreta para firmar webhooks de pagos (Flow/Stripe)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'mi-clave-secreta-de-webhook';

// Generar una clave de licencia única con formato FP-YYYY-XXXX-XXXX-XXXX
function generateLicenseKey() {
  const currentYear = new Date().getFullYear();
  const randomSegment = () => crypto.randomBytes(4).toString('hex').toUpperCase();
  return `FP-${currentYear}-${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}

/**
 * 1. Webhook de confirmación de pago (ejemplo para Flow.cl o Stripe)
 */
app.post('/api/webhook/payment', (req, res) => {
  const signature = req.headers['x-flow-signature'] || req.headers['stripe-signature'];
  
  // En producción: Verificar la firma del webhook aquí
  
  const { email, plan, customer_name } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Falta el correo del cliente.' });
  }

  const key = generateLicenseKey();
  const licenseData = {
    email: email.trim().toLowerCase(),
    customerName: customer_name || 'Cliente FastPOS',
    licenseKey: key,
    plan: plan || 'Básico',
    activatedDevices: [],
    maxDevices: plan === 'Pro' ? 2 : 1,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  // Guardar en la base de datos
  activeLicenses.set(key, licenseData);

  console.log(`[VENTA] Licencia generada para ${email}: ${key}`);

  // En producción: Integrar con Nodemailer, SendGrid o Mailgun para enviar el email con la clave de licencia y link de descarga
  
  res.json({ success: true, licenseKey: key });
});

/**
 * 2. Endpoint de Activación (Llamado por el cliente FastPOS)
 */
app.post('/api/license/activate', (req, res) => {
  const { email, licenseKey, deviceId } = req.body;

  if (!email || !licenseKey) {
    return res.status(400).json({ error: 'Correo y clave de licencia son requeridos.' });
  }

  const normalizedKey = licenseKey.trim().toUpperCase();
  const normalizedEmail = email.trim().toLowerCase();

  const license = activeLicenses.get(normalizedKey);

  if (!license) {
    return res.status(404).json({ error: 'La clave de licencia no existe.' });
  }

  if (license.email !== normalizedEmail) {
    return res.status(400).json({ error: 'El correo electrónico no coincide con el registrado en la compra.' });
  }

  if (license.status !== 'active') {
    return res.status(400).json({ error: 'Esta licencia está suspendida o inactiva.' });
  }

  // Control de dispositivos (evita piratería en múltiples PCs)
  const currentDevices = license.activatedDevices || [];
  const deviceIdentified = deviceId || 'default-device';

  if (!currentDevices.includes(deviceIdentified)) {
    if (currentDevices.length >= license.maxDevices) {
      return res.status(400).json({ 
        error: `Límite de dispositivos alcanzado. Esta licencia permite máximo ${license.maxDevices} equipo(s).` 
      });
    }
    currentDevices.push(deviceIdentified);
    license.activatedDevices = currentDevices;
    activeLicenses.set(normalizedKey, license);
  }

  // Firma criptográfica del certificado de activación local
  // En producción: firmar con RSA o clave asimétrica para que el cliente lo valide offline de forma segura
  const signaturePayload = `${normalizedKey}:${normalizedEmail}:${license.status}`;
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(signaturePayload).digest('hex');

  res.json({
    success: true,
    message: 'Activación autorizada exitosamente.',
    license: {
      email: normalizedEmail,
      licenseKey: normalizedKey,
      status: license.status,
      activatedAt: new Date().toISOString().split('T')[0],
      signature
    }
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Servidor de licencias FastPOS corriendo en el puerto ${PORT}`);
});
