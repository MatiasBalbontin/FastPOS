# Activación de FastPOS — Modo Administrador

> **Solo para uso interno del desarrollador.**  
> Este archivo describe cómo activar FastPOS sin pasar por el proceso de pago.

---

## Método 1 — Crear el archivo de licencia manualmente (recomendado)

FastPOS verifica si existe un archivo `.license` en la raíz del proyecto.  
Si el archivo existe, tiene `status: "active"` y una clave que empiece con `FP-`, el sistema se activa.

### Pasos

1. Abre el explorador de archivos y navega a la carpeta del proyecto:
   ```
   d:\FastPOSv1.2 - MP\FastPOS\
   ```

2. Crea un archivo llamado exactamente `.license` (sin extensión visible, con punto al inicio).

   En Windows: abre el Bloc de Notas, escribe el contenido de abajo, y al guardar elige  
   **"Todos los archivos"** y escribe `.license` como nombre.

3. El contenido del archivo debe ser:

   ```json
   {
     "email": "admin@fastpos.cl",
     "licenseKey": "FP-ADMIN-MASTER-2026",
     "activatedAt": "2026-01-01",
     "status": "active"
   }
   ```

4. Guarda el archivo y abre/reinicia FastPOS. El sistema arrancará directamente en el login.

---

## Método 2 — Activar desde la interfaz gráfica (sin pago)

El sistema acepta cualquier clave que empiece con `FP-` y tenga al menos 10 caracteres.

1. Inicia FastPOS con `IniciarFastPOS.bat`.
2. Si aparece la pantalla de **"Activar FastPOS"**, ingresa:
   - **Correo:** cualquier correo válido (ej. `admin@tutienda.cl`)
   - **Clave de licencia:** `FP-ADMIN-MASTER-2026`
3. Haz clic en **Activar Licencia**.
4. El sistema se activará y pasará al login.

---

## Crear el primer usuario administrador

Una vez activado, FastPOS mostrará el login. Si es la primera vez, el sistema crea automáticamente un usuario `admin` por defecto.

**Credenciales por defecto:**
- Usuario: `admin`
- Contraseña: `admin123`

> **Cambia la contraseña inmediatamente** desde Configuración → Usuarios y Permisos.

Si el usuario admin no aparece o fue eliminado, puedes crearlo directamente en la base de datos:

```bash
# Desde la carpeta del proyecto, ejecutar en terminal:
node -e "
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('./inventory.db');
const hash = bcrypt.hashSync('admin123', 10);
const perms = JSON.stringify(['sales','inventory','analytics','history','expenses','receivables','quotes','configuration','entities']);
db.prepare(\"INSERT OR REPLACE INTO users (username, password, permissions, active) VALUES (?, ?, ?, 1)\").run('admin', hash, perms);
console.log('Usuario admin creado correctamente.');
db.close();
"
```

---

## Permisos disponibles

Al crear usuarios desde la interfaz, puedes asignar cualquier combinación de estos permisos:

| Permiso         | Acceso que otorga                         |
|-----------------|-------------------------------------------|
| `sales`         | Punto de venta y registro de ventas       |
| `inventory`     | Gestión de productos e inventario         |
| `analytics`     | Reportes y dashboard de análisis          |
| `history`       | Historial de transacciones                |
| `expenses`      | Registro de gastos                        |
| `receivables`   | Cuentas por cobrar y ventas fiadas        |
| `quotes`        | Módulo de cotizaciones PDF                |
| `configuration` | Configuración del sistema y actualizaciones |
| `entities`      | Gestión de clientes y entidades           |

---

## Ubicación del archivo de licencia

```
d:\FastPOSv1.2 - MP\FastPOS\.license
```

Si necesitas desactivar el sistema (para hacer pruebas de la pantalla de activación), simplemente **elimina ese archivo** y reinicia FastPOS.
