# Auditoría FastPOS v1.2 — Observaciones y Hallazgos

**Fecha de auditoría:** 2026-06-07  
**Rama auditada:** `oficialoffline`  
**Auditor:** Claude Sonnet 4.6

---

## Resumen Ejecutivo

FastPOS es un sistema POS (Punto de Venta) full-stack con backend Express/TypeScript, frontend React 19 y base de datos SQLite local. El sistema es funcional para **uso local y personal**, pero presenta problemas críticos de seguridad, calidad de código y arquitectura que lo hacen inadecuado para uso comercial o multi-usuario sin correcciones previas.

| Métrica | Puntaje | Nota |
|---------|---------|------|
| Arquitectura | 4/10 | D |
| Manejo de errores | 3/10 | F |
| Seguridad | 2/10 | F |
| Cobertura de tests | 2/10 | F |
| Documentación | 2/10 | F |
| Tipado (TypeScript) | 5/10 | D |
| Rendimiento | 6/10 | C- |
| **TOTAL** | **3/10** | **F** |

---

## 1. Estructura del Proyecto

### Stack tecnológico
- **Backend:** Express.js + TypeScript (`server.ts`)
- **Frontend:** React 19 + TypeScript + Vite (`src/App.tsx`)
- **Base de datos:** SQLite via `better-sqlite3`
- **Estilos:** Tailwind CSS v4
- **Gráficos:** Recharts
- **Exportación:** jsPDF, xlsx

### Archivos principales
| Archivo | Líneas | Observación |
|---------|--------|-------------|
| `server.ts` | 1.269 | Todo el backend en un solo archivo |
| `src/App.tsx` | 3.741 | Todo el frontend en un solo archivo |
| `tests/sales.test.ts` | 92 | Único archivo de tests |
| `src/lib/utils.ts` | — | Utilidades menores |

---

## 2. Problemas Críticos

### 2.1 Datos sensibles hardcodeados en el código fuente

**Severidad: CRÍTICO**

**Archivos:** `server.ts` líneas 150–155 y `src/App.tsx` líneas 3098–3105

Información real de empresa está embebida directamente en el código:
- Nombre de empresa
- RUT (`76.794.328-8`)
- Dirección
- Teléfono
- Email (`haciendasanjuan@gmail.com`)
- **Número de cuenta bancaria** (`Nº 44700072301`)

Esto implica que cualquier persona con acceso al repositorio Git (incluso a través del historial) puede ver estos datos. El número de cuenta bancaria es especialmente sensible.

**Corrección:** Mover estos valores a variables de entorno o a un archivo de configuración excluido del repositorio (`.env`, `config.local.json`).

---

### 2.2 Ausencia total de autenticación y autorización

**Severidad: CRÍTICO**

**Archivo:** `server.ts` (todos los endpoints)

Los 30+ endpoints de la API son completamente abiertos. Cualquier proceso con acceso a la red puede:
- Leer todos los datos de clientes (datos personales, RUT, créditos)
- Modificar inventario y precios
- Crear ventas o gastos falsos
- Acceder a registros financieros completos

No existe ningún mecanismo de sesión, token, ni control de acceso.

**Corrección:** Implementar autenticación (ej. JWT o sesiones HTTP) y middleware de autorización antes de cualquier despliegue no local.

---

### 2.3 Lógica FIFO permite stock negativo

**Severidad: CRÍTICO**

**Archivo:** `server.ts` líneas 371–400

Cuando se vende más cantidad de la disponible en stock, el sistema crea un lote con cantidad negativa en lugar de rechazar la venta:

```typescript
if (remainingToSell > 0) {
  // Crea un lote con cantidad NEGATIVA
  db.prepare('INSERT INTO batches (...) VALUES (...)')
    .run(product_id, -remainingToSell, -remainingToSell, fallbackCost);
}
```

Esto corrompe los cálculos de stock y costos FIFO silenciosamente.

**Corrección:** Validar stock disponible antes de procesar la venta y devolver error `400` si es insuficiente.

---

### 2.4 Sin rate limiting ni protección contra abuso

**Severidad: ALTO**

**Archivo:** `server.ts`

No hay límite de solicitudes por IP ni por tiempo. El servidor es vulnerable a denegación de servicio (DoS) y fuerza bruta.

**Corrección:** Usar `express-rate-limit` en todos los endpoints.

---

## 3. Problemas de Arquitectura

### 3.1 App.tsx monolítico (3.741 líneas)

**Severidad: ALTO**

Todo el frontend está en un único archivo con 16 componentes distintos mezclados con lógica de negocio, generación de PDFs y llamadas a la API:

| Componente | Líneas aprox. |
|------------|---------------|
| `App` | 96–343 |
| `SalesView` | 347–544 |
| `PaymentModal` | 547–795 |
| `InventoryView` | 797–1020 |
| `AnalyticsView` | 1023–1297 |
| `StatCard` | 1299–1313 |
| `EditProductModal` | 1317–1481 |
| `ImportModal` | 1483–1587 |
| `ExpressModal` | 1590–1725 |
| `HistoryView` | 1727–1852 |
| `ExpensesView` | 1855–1997 |
| `ReceivablesView` | 1999–2140 |
| `FixedCostsView` | 2142–2259 |
| `EntitiesView` | 2262–2671 |
| `ConfigurationView` | 2673–2834 |
| `QuotesView` | 2837–3741 |

**Consecuencias:**
- Mantenimiento muy difícil
- Sin posibilidad de tests unitarios por componente
- HMR lento en desarrollo
- Refactoring riesgoso

**Corrección sugerida:** Crear `src/components/` con un archivo por componente, y `src/hooks/` para lógica reutilizable.

---

### 3.2 server.ts monolítico (1.269 líneas)

**Severidad: MEDIO**

Schema de base de datos, migraciones, inicialización y todos los endpoints conviven en un único archivo sin organización por rutas o dominios.

**Corrección sugerida:**
```
server/
  routes/
    products.ts
    sales.ts
    analytics.ts
    ...
  db/
    schema.ts
    migrations.ts
  middleware/
    auth.ts
    errorHandler.ts
```

---

### 3.3 Sin capa de servicios ni abstracción de API en el frontend

**Severidad: MEDIO**

Los componentes llaman directamente a `fetch('/api/...')` sin ninguna capa de abstracción. Cambiar una URL o el formato de respuesta requiere editar múltiples componentes.

**Corrección:** Crear `src/services/api.ts` con funciones tipadas para cada endpoint.

---

## 4. Problemas de Calidad de Código

### 4.1 Uso extensivo de `any` en TypeScript

**Severidad: MEDIO**

**Archivo:** `src/App.tsx`

Los props de casi todos los componentes están tipados como `any`, eliminando el beneficio de TypeScript:

```typescript
function SalesView({ searchInputRef, onSale, products, onProductNotFound }: any)
function PaymentModal({ total, onClose, onConfirm }: any)
function InventoryView({ products, onRefresh, onAddProduct... }: any)
```

**Corrección:** Definir interfaces o tipos para cada conjunto de props.

---

### 4.2 Manejo de errores incompleto

**Severidad: MEDIO**

**Archivo:** `server.ts` líneas 941–948

Se usa `error: any` y se detecta el tipo de error mediante comparación de strings:

```typescript
} catch (error: any) {
  if (error.message.includes('UNIQUE constraint failed')) {
    ...
  }
}
```

Los bloques `catch` en las migraciones también ignoran errores sin validar que sean del tipo esperado (líneas 42–44, 79–83).

**Corrección:** Crear tipos de error específicos y un middleware centralizado de manejo de errores.

---

### 4.3 Sin validación de entradas en la API

**Severidad: MEDIO**

**Archivo:** `server.ts`

- Línea 196: `sale_price` no validado como número positivo
- Línea 257: `new_stock` convertido a entero sin límites
- Línea 365: `quantity` no validado como > 0 antes de procesar venta
- Ningún endpoint valida formato de RUT, email u otros campos estructurados

**Corrección:** Usar `zod` o `joi` para esquemas de validación en cada endpoint.

---

### 4.4 Aritmética de punto flotante para moneda

**Severidad: MEDIO**

**Archivo:** `server.ts` líneas 385, 443

```typescript
totalCost += sellFromThisBatch * batch.cost;
```

Las operaciones con `float` acumulan errores de redondeo en cálculos monetarios (`0.1 + 0.2 ≠ 0.3`).

**Corrección:** Almacenar precios en centavos (enteros) o usar una librería decimal.

---

### 4.5 Sin memoización ni optimización de re-renders

**Severidad: BAJO**

**Archivo:** `src/App.tsx`

Ningún componente usa `React.memo`, `useMemo` o `useCallback`. En una pantalla con muchos productos, cada cambio de estado re-renderiza todo el árbol.

---

## 5. Base de Datos

### 5.1 Foreign keys no habilitados

**Severidad: ALTO**

**Archivo:** `server.ts`

SQLite no enforce foreign keys por defecto. El código define `FOREIGN KEY ... REFERENCES ...` en el schema pero nunca ejecuta:

```sql
PRAGMA foreign_keys = ON;
```

Esto significa que se pueden insertar ventas con `product_id` inexistente sin error.

**Corrección:** Agregar `db.pragma('foreign_keys = ON')` al inicializar la base de datos.

---

### 5.2 Índices faltantes

**Severidad: ALTO**

Las columnas más consultadas no tienen índices, lo que degradará el rendimiento con volúmenes de datos reales:

| Columna | Tabla | Usada en |
|---------|-------|----------|
| `created_at` | `sales` | Consultas de historial y analytics |
| `ticket_id` | `sales` | Agrupación de ventas por ticket |
| `product_id` | `sales`, `batches` | JOINs frecuentes |
| `customer_id` | `receivables` | JOINs de cuentas corrientes |

**Corrección:**
```sql
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_ticket_id ON sales(ticket_id);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);
```

---

### 5.3 Restricción UNIQUE en RUT nullable

**Severidad: BAJO**

**Archivo:** `server.ts` línea 62

`rut TEXT UNIQUE` permite múltiples filas con `NULL` en SQLite, pero no protege contra duplicados cuando se ingresa un RUT.

---

## 6. Dependencias

### 6.1 Dependencias instaladas pero no usadas

**Archivo:** `package.json`

| Paquete | Versión | Problema |
|---------|---------|---------|
| `@google/genai` | 1.29.0 | Instalado, no importado en ningún archivo |
| `dotenv` | 17.2.3 | Importado en `server.ts` pero `dotenv.config()` nunca se llama |

Además, `vite.config.ts` línea 11 expone `GEMINI_API_KEY` como variable de entorno sin que sea usada:

```typescript
'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
```

**Corrección:**
```bash
npm uninstall @google/genai
```
Remover la referencia a `GEMINI_API_KEY` de `vite.config.ts` y el import de `dotenv` de `server.ts`.

---

## 7. Tests

### Cobertura actual: < 5%

**Archivo:** `tests/sales.test.ts` (92 líneas, 2 casos de prueba)

Solo se testea la lógica FIFO de ventas en aislamiento. No existen tests para:
- Endpoints de la API
- Manejo de errores
- Componentes de React
- Casos límite (stock en 0, montos negativos, RUT inválido)
- Transacciones concurrentes

**Recomendación:** Apuntar a 60%+ de cobertura usando Vitest para backend y React Testing Library para frontend.

---

## 8. Documentación

### Estado: Insuficiente

| Elemento | Estado |
|----------|--------|
| README.md | Básico (48 líneas, solo instalación) |
| Documentación de API | Ausente |
| Schema de base de datos | Ausente |
| Comentarios en código complejo | Mínimos |
| Guía de despliegue | Ausente |
| Diagrama de arquitectura | Ausente |

---

## 9. Plan de Correcciones Priorizadas

### Prioridad 1 — Inmediato (antes de cualquier uso productivo)

1. Mover datos de empresa y cuenta bancaria a archivo de configuración no versionado
2. Implementar autenticación básica (al menos contraseña local)
3. Rechazar ventas cuando el stock es insuficiente (no crear lotes negativos)
4. Habilitar `PRAGMA foreign_keys = ON` al iniciar la base de datos

### Prioridad 2 — Corto plazo

5. Agregar índices en columnas de búsqueda frecuente
6. Agregar validación de entradas en todos los endpoints (`zod`)
7. Implementar rate limiting (`express-rate-limit`)
8. Desinstalar dependencias no utilizadas
9. Corregir tipado `any` en props de componentes React

### Prioridad 3 — Mediano plazo

10. Separar `App.tsx` en archivos por componente
11. Separar `server.ts` en módulos por dominio
12. Crear capa de servicios en el frontend
13. Escribir tests para endpoints críticos (ventas, inventario)
14. Reemplazar aritmética float por enteros o librería decimal
15. Agregar documentación de API (Swagger/OpenAPI)

---

## 10. Observaciones Positivas

- Las consultas SQL usan correctamente parámetros preparados (sin riesgo de SQL injection)
- Se usa TypeScript en todo el proyecto (aunque con `any` frecuente)
- La lógica FIFO para costo de ventas está implementada (aunque con el bug de stock negativo)
- El sistema de categorías y la gestión de lotes están bien conceptualizados
- Uso de transacciones SQLite en operaciones críticas

---

*Auditoría generada por Claude Code — para uso interno del equipo de desarrollo.*
