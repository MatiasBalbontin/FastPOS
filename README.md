# FastPOS v1.2 — Edición Profesional

FastPOS es un sistema de Punto de Venta (POS) rápido y eficiente, diseñado para funcionar 100% de manera local con bases de datos SQLite y una interfaz web premium reactiva. Esta versión ha sido profesionalizada y securizada para cumplir con estándares comerciales de seguridad, rendimiento y mantenibilidad.

---

## 🚀 Características Principales

### 🔒 Seguridad y Robustez
- **Autenticación Local Segura**: Middleware de sesión con cookies (`express-session`) que restringe el acceso al POS y la API. Interceptor global en el cliente para redirección automática al Login ante expiraciones de sesión.
- **Protección contra Fuga de Datos**: Configuración dinámica de la empresa y parámetros a través de variables de entorno (`.env`), eliminando datos sensibles del código fuente.
- **Prevención de Venta sin Stock**: El motor de ventas FIFO bloquea transacciones que superen las existencias físicas actuales para evitar lotes con stock negativo.
- **Validación de Datos Rigurosa**: Validación de payloads y esquemas de entrada con **Zod** en todos los endpoints, incluyendo validación algorítmica del dígito verificador del RUT chileno.
- **Seguridad en Red**: Rate limiter general (200 req/min) y rate limiter estricto para intentos de acceso (10 req/min).
- **Manejo Centralizado de Errores**: Middleware centralizado que encapsula errores operacionales SQLite y oculta trazas en producción.
- **Aritmética de Costos Precisa**: Precisión aritmética monetaria garantizada en el cálculo FIFO usando la librería `decimal.js`.

### 🏗️ Arquitectura Modular
- **Backend Orientado a Dominios**: Rutas y lógica de control desacopladas en módulos específicos (`server/routes/*`, `server/db/*`, `server/middleware/*`).
- **Frontend Reactivo Componentizado**: Monolito de React descompuesto en subcomponentes modulares, reutilizables e independientes dentro de `src/components/` (`SalesView`, `InventoryView`, `AnalyticsView`, etc.).
- **Strict TypeScript**: Compilación bajo bandera `"strict": true` con tipos definidos para todos los props y componentes.
- **Rendimiento de Base de Datos**: Activación de integridad referencial (`foreign_keys = ON`) e índices compuestos en base de datos SQLite para acelerar consultas concurrentes y timeline de historial.

---

## 🛠️ Requisitos de Instalación y Ejecución

### 1. Variables de Entorno
Cree un archivo `.env` en la raíz del proyecto basándose en `.env.example`:
```env
PORT=3000
ADMIN_PASSWORD=su-contrasena-segura
SESSION_SECRET=un-secreto-aleatorio-largo
COMPANY_NAME=Mi Empresa SpA
COMPANY_RUT=76.794.328-8
COMPANY_ADDRESS=Calle Principal 123, Santiago
COMPANY_PHONE=+56912345678
COMPANY_EMAIL=contacto@miempresa.cl
COMPANY_BANK_DETAILS=Banco Estado, Cuenta Corriente 123456
```

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Ejecutar en Modo Desarrollo
```bash
npm run dev
```

### 4. Construcción para Producción
```bash
npm run build
```

---

## 🧪 Pruebas Automatizadas y Calidad

### Tipo de Código (Linter)
Valida que todo el código cumpla con los tipos de datos estrictos definidos:
```bash
npm run lint
```

### Suite de Tests (Vitest)
Ejecuta la suite de pruebas unitarias y de integración para validar la lógica FIFO, la validación de RUT chileno y los esquemas de datos Zod:
```bash
npm run test
```

---

## 📖 Documentación de la API (Swagger)
El servidor expone de manera interactiva la documentación de todos los endpoints de la API (OpenAPI 3.0). Una vez iniciado el servidor, acceda en:
👉 **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

---

## ⚖️ Licencia
Distribuido bajo la Licencia **GPLv3**. Ver el archivo `LICENSE` para más detalles.
