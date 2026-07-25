import { db } from './index';

/**
 * Inserta un registro en el historial de auditoría de la base de datos.
 * Esta función está protegida con try/catch para evitar interrumpir la ejecución de las rutas del POS en caso de fallar.
 * 
 * @param userId ID del operador ejecutor (null si no está autenticado)
 * @param username Nombre del operador ejecutor
 * @param action Acción realizada (ej: 'LOGIN_SUCCESS', 'VOID_SALE', etc.)
 * @param details Detalles adicionales serializables en formato JSON
 */
export function logAudit(
  userId: number | null | undefined,
  username: string | null | undefined,
  action: string,
  details?: any
) {
  try {
    const serializedDetails = details ? JSON.stringify(details) : null;
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, details)
      VALUES (?, ?, ?, ?)
    `).run(userId || null, username || null, action, serializedDetails);
  } catch (err) {
    console.error('[AUDITORÍA ERROR] No se pudo escribir en el registro de auditoría:', err);
  }
}
