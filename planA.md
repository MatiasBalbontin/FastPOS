# FastPOS — Plan de Comercialización: Modalidad A (Descarga Local)

**Versión:** 1.0  
**Fecha:** 2026-07-01  
**Autor:** Matías Balbontín  

---

## Resumen Ejecutivo

FastPOS se comercializa como un programa que el cliente instala en su propio computador con Windows. Los datos viven en la máquina del cliente, el programa funciona sin internet, y la seguridad ante pérdida de datos se resuelve con respaldo automático a Google Drive. El soporte técnico se presta de forma remota mediante AnyDesk o TeamViewer.

**Objetivo del producto (definido):** FastPOS es una herramienta de **control operativo** para negocios pequeños — stock, ventas, caja diaria y seguimiento básico de fiado/clientes — **no un ERP contable**. No emite documentos tributarios, no lleva libros contables ni concilia con bancos. Su ventaja competitiva es ser 100% offline, de instalación simple (doble clic) y sin dependencias de servidores propios. Cualquier feature nueva debe evaluarse contra esta restricción: si agrega complejidad de instalación, requiere conexión permanente, o empuja el producto hacia contabilidad formal, no encaja en el alcance.

--

## Registro de Ajustes Recientes

### 2026-07-24 — Fix: admin no podía fiar en el POS

El usuario `admin` no podía generar ventas al fiado (`cuenta_por_cobrar`) desde el Punto de Venta. Causa: `"fiar"` se implementó como permiso granular independiente del módulo `sales`, y a diferencia de todos los demás módulos —que tratan `username === 'admin'` como comodín universal vía `requirePermission`/`requireAnyPermission`— el chequeo específico `requireFiarPermission()` en `server/routes/sales.ts` no tenía ese bypass, ni tampoco la condición del botón en `SalesView.tsx`. Esto no era cosmético: el saldo de cuentas por cobrar (`receivables.ts`) se calcula directo desde las ventas con ese `payment_method`, así que el bug bloqueaba una operación financiera real. **Fix aplicado:** se agregó el bypass de admin en backend y frontend, igual que el resto del sistema.

**Pendiente:** auditar si existen otros permisos granulares (fuera de los módulos base) con el mismo patrón de omisión.

**Próximos pasos sugeridos (alineados al objetivo de control operativo, offline):**
1. Auditoría rápida de permisos: listar todo chequeo ad-hoc fuera de `requirePermission`/`requireAnyPermission` (patrón `session.permissions?.includes(...)` directo) y unificarlos.
2. Priorizar Fase 0 (hardening: bcrypt, `.env` seguro, Zod completo) antes de seguir agregando funciones — es lo que habilita vender con confianza.
3. No expandir el alcance hacia contabilidad formal (boletas/facturas electrónicas SII, libros, conciliación bancaria): mantiene la promesa de "simple, offline, instalación en 1 clic".
4. Dado que "fiar" ahora genera deuda real desde más usuarios, adelantar Fase 2 (respaldo automático) para no perder ese dato ante falla del PC.
5. Agregar una nota breve en el manual/UI aclarando que FastPOS es control operativo, no un sistema contable, para alinear expectativas del cliente.

---

## Estructura del Plan

| Fase | Nombre  |
|------|--------|
| 0 | Hardening de seguridad |
| 1 | Build de producción |
| 2 | Respaldo automático + Google Drive
| 3 | Sistema de licencias 
| 4 | Instalador profesional 
| 5 | Portal de ventas 
| 6 | Protocolo de soporte remoto |

---

## Fase 0 — Hardening de Seguridad

> Antes de vender, el producto debe ser seguro. Estos cambios son obligatorios.

### 0.1 Reemplazar SHA-256 con bcrypt

**Problema actual:** Las contraseñas se guardan con SHA-256 sin salt. Si alguien accede al archivo `inventory.db`, puede descifrar las contraseñas fácilmente con tablas predefinidas.

**Solución:**
- Instalar el paquete `bcrypt`
- Modificar `server/middleware/auth.ts` para usar `bcrypt.hash()` al guardar contraseñas y `bcrypt.compare()` al verificar
- Agregar migración automática: la primera vez que un usuario inicia sesión con la versión nueva, su contraseña SHA-256 se reemplaza por bcrypt de forma transparente

**Archivos a modificar:**
- `server/middleware/auth.ts` — función `hashPassword()` y verificación en login
- `server/routes/auth.ts` — lógica de comparación de contraseña
- `server/routes/users.ts` — creación y edición de usuarios

### 0.2 Eliminar fallbacks inseguros

**Problema actual:** Si el archivo `.env` no existe, el sistema usa `SESSION_SECRET = 'fallback-secret-key-12345'` y `ADMIN_PASSWORD = 'admin'`.

**Solución:**
- En el primer arranque del programa, si no existe `.env`, generarlo automáticamente con un `SESSION_SECRET` aleatorio de 64 caracteres y una contraseña admin aleatoria
- Mostrar la contraseña admin generada en pantalla **una sola vez** para que el dueño la anote
- Nunca más usar strings hardcodeados como fallback

**Archivos a modificar:**
- `server/server.ts` — lógica de arranque inicial

### 0.3 Completar validación Zod

**Problema actual:** Los módulos `fixedCosts.ts` y `quotes.ts` no usan el middleware `validateBody()` que el resto del sistema ya usa.

**Solución:** Agregar esquemas Zod y `validateBody()` en ambos módulos, siguiendo el mismo patrón de `products.ts` o `sales.ts`.

**Archivos a modificar:**
- `server/routes/fixedCosts.ts`
- `server/routes/quotes.ts`
- `server/middleware/validation.ts` — agregar los esquemas nuevos

---

## Fase 1 — Build de Producción

> Actualmente FastPOS corre en modo desarrollo (`tsx watch`). Para venderlo debe correr en modo producción.

### 1.1 Configurar script de producción

- Ejecutar `npm run build` genera la carpeta `/dist` con el frontend compilado y optimizado
- Crear script `npm run start` que lanza Express en modo producción sirviendo `/dist`
- Verificar que todas las rutas funcionen igual en modo producción

### 1.2 Actualizar lanzadores Windows

- Modificar `IniciarFastPOS.bat` para ejecutar `npm run build && npm run start` en vez de `npm run dev`
- Verificar que `LanzadorOculto.vbs` funcione correctamente con el nuevo flujo

### 1.3 Pruebas en máquina limpia

- Probar instalación completa en un PC sin Node.js instalado
- Verificar que el script descarga Node portable, instala dependencias, buildea y abre el navegador sin intervención manual
- Documentar cualquier error y corregirlo

---

## Fase 2 — Respaldo Automático y Sincronización con Google Drive

> Esta fase resuelve el único riesgo real de la Modalidad A: que el cliente pierda sus datos si el computador falla.

### 2.1 Diseño de la solución

La solución se divide en dos capas complementarias:

**Capa 1 — Sincronización continua (Google Drive):**  
La carpeta que contiene `inventory.db` se sincroniza automáticamente a Google Drive del cliente. Cada vez que FastPOS modifica la base de datos, Google Drive lo detecta y sube los cambios a la nube. Esto ocurre en segundo plano sin que el cliente haga nada.

**Capa 2 — Respaldo estructurado (copia mensual):**  
FastPOS genera una copia fechada del archivo de base de datos una vez al mes y la guarda en una subcarpeta de respaldos. Así el cliente tiene versiones históricas a las que puede volver si algo sale mal dentro del programa (datos incorrectos, etc.).

### 2.2 Pauta de procedimiento: Configuración de Google Drive (para el cliente)

Este procedimiento lo realiza el técnico (o el cliente siguiendo instrucciones) **una sola vez** al momento de la instalación.

---

#### PASO 1 — Instalar Google Drive en el PC del cliente

1. Abrir el navegador y entrar a `drive.google.com`
2. Iniciar sesión con la cuenta Google del cliente (o crear una nueva si no tiene)
3. Hacer clic en el ícono de engranaje (⚙️) arriba a la derecha → **"Obtener Drive para ordenadores"**
4. Descargar e instalar la aplicación **"Google Drive para escritorio"**
5. Durante la instalación, iniciar sesión con la misma cuenta Google
6. Al terminar, aparece una nueva unidad en el Explorador de Windows llamada **"Google Drive (G:)"** o similar

---

#### PASO 2 — Crear la carpeta de sincronización

1. Abrir el Explorador de Windows
2. Navegar a la unidad de Google Drive que apareció (ej: `G:\Mi unidad\`)
3. Crear una carpeta nueva llamada: `FastPOS_Respaldo`
4. Dentro de esa carpeta, crear otras dos:
   - `FastPOS_Respaldo\BD_Diaria` ← aquí irá la base de datos sincronizada
   - `FastPOS_Respaldo\BD_Mensual` ← aquí irán las copias mensuales

---

#### PASO 3 — Configurar FastPOS para usar esa carpeta

> Este paso lo hace la aplicación automáticamente si está bien configurada, o el técnico lo hace manualmente editando el archivo `.env`.

Abrir el archivo `.env` dentro de la carpeta de FastPOS y agregar o editar las siguientes líneas:

```
BACKUP_PATH=G:\Mi unidad\FastPOS_Respaldo\BD_Diaria
MONTHLY_BACKUP_PATH=G:\Mi unidad\FastPOS_Respaldo\BD_Mensual
```

Reemplazar `G:\Mi unidad\` con la letra de unidad real que tiene Google Drive en ese PC.

---

#### PASO 4 — Verificar que la sincronización funciona

1. Abrir FastPOS y realizar cualquier operación (una venta de prueba, por ejemplo)
2. Esperar 2 minutos
3. Abrir el Explorador de Windows y navegar a `G:\Mi unidad\FastPOS_Respaldo\BD_Diaria\`
4. Debe aparecer el archivo `inventory.db` (o `inventory_YYYY-MM-DD.db`)
5. Entrar a `drive.google.com` desde el navegador y verificar que el archivo también aparece ahí en la nube

Si el archivo aparece en la web de Drive, la sincronización está funcionando.

---

#### PASO 5 — Verificar el respaldo mensual (primer mes)

El primer día de cada mes, FastPOS genera automáticamente una copia del archivo con la fecha en el nombre (ej: `inventory_2026-07-01.db`) y la guarda en `BD_Mensual`. 

Para verificar manualmente que funciona:
1. Ir a la configuración de FastPOS → sección **Sistema**
2. Hacer clic en **"Generar respaldo ahora"**
3. Verificar que aparece el archivo en `BD_Mensual` y en Drive

---

### 2.3 Desarrollo requerido en FastPOS

Para que la Fase 2 funcione, hay que agregar lo siguiente al código:

#### 2.3.1 Módulo de respaldo (`server/backup.ts`)

Crear un módulo que:
- Se ejecuta automáticamente cuando el servidor arranca
- Programa una tarea que corre a las 23:00 de cada día y copia `inventory.db` a `BACKUP_PATH` con el nombre `inventory_YYYY-MM-DD.db`
- Programa una tarea mensual (primer día del mes) que copia a `MONTHLY_BACKUP_PATH`
- Mantiene solo los últimos 30 respaldos diarios (elimina los más antiguos automáticamente)
- Registra en un log simple (`backup.log`) cada respaldo exitoso o fallido

Librería sugerida: `node-cron` (ligera, sin dependencias externas)

#### 2.3.2 Ruta de respaldo manual (`server/routes/system.ts`)

Agregar endpoint `POST /api/system/backup` que:
- Genera un respaldo inmediato bajo demanda
- Devuelve el nombre del archivo generado y su tamaño
- Solo accesible con permiso `configuration`

#### 2.3.3 UI en ConfigurationView (`src/components/ConfigurationView.tsx`)

Agregar sección **"Respaldo y Sincronización"** que muestre:
- Ruta configurada de respaldo (editable)
- Fecha y tamaño del último respaldo exitoso
- Botón **"Generar respaldo ahora"**
- Estado del último respaldo (éxito / error con mensaje)
- Instrucciones resumidas para configurar Google Drive (enlace a guía PDF)

#### 2.3.4 Variables de entorno nuevas (`.env.example`)

```
# Respaldo automático
BACKUP_PATH=            # Ruta carpeta BD_Diaria en Google Drive
MONTHLY_BACKUP_PATH=    # Ruta carpeta BD_Mensual en Google Drive  
BACKUP_RETENTION_DAYS=30  # Días que se guardan los respaldos diarios
```

---

### 2.4 Pauta de recuperación ante desastre

> Procedimiento a seguir cuando el cliente pierde el computador o el disco duro falla.

**Tiempo estimado de recuperación: 20–30 minutos.**

1. En el PC nuevo, instalar FastPOS normalmente (ejecutar el instalador)
2. Instalar Google Drive y conectarlo con la cuenta del cliente
3. Esperar que Google Drive termine de sincronizar (puede tomar varios minutos dependiendo del tamaño)
4. Una vez que `inventory.db` aparece en la carpeta local de Google Drive, copiarlo a la carpeta de FastPOS reemplazando el archivo vacío que creó la instalación nueva
5. Abrir FastPOS — todos los datos estarán intactos hasta el último respaldo sincronizado
6. Conectarse por AnyDesk para verificar que todo quedó bien y que la sincronización volvió a activarse

> **Nota importante:** Si el cliente no tenía Google Drive configurado, los datos se pierden permanentemente. Por esto, la configuración de Drive debe hacerse siempre en la instalación inicial y no puede ser opcional.

---

## Fase 3 — Sistema de Licencias

> Impide que el cliente copie el programa a otros computadores sin pagar.

### 3.1 Cómo funciona

Cuando el cliente compra, el sistema de ventas genera una **clave de licencia única** (ej: `FP-2026-XXXX-XXXX-XXXX`). Esa clave está vinculada al email del comprador.

La primera vez que abre FastPOS, ingresa esa clave. El programa:
1. Envía la clave a un servidor de activación (único momento que necesita internet)
2. El servidor verifica que la clave es válida y no fue activada antes
3. Guarda localmente un "certificado" firmado digitalmente que contiene la clave y la fecha de expiración
4. Desde ese momento funciona completamente offline, verificando solo el certificado local

Si intenta instalar en un segundo PC con la misma clave, el servidor la rechaza (ya fue activada).

### 3.2 Desarrollo requerido

- **Servidor de licencias:** Puede ser un endpoint simple en cualquier hosting gratuito (Vercel, Render) con una base de datos pequeña que registra qué claves existen y en qué estado están
- **Módulo de activación en FastPOS:** Pantalla inicial de activación si no hay certificado válido
- **Verificación periódica:** FastPOS verifica la vigencia del certificado local al arrancar (sin internet — solo lee el archivo firmado)
- **Generación de claves:** Script en el servidor de licencias que genera claves nuevas cuando Stripe confirma un pago

### 3.3 Política de licencias sugerida

| Plan | Precio | Instalaciones | Actualizaciones | Soporte |
|------|--------|---------------|-----------------|---------|
| Básico (pago único) | $99.000 CLP | 1 PC | 1 año incluido | Sin soporte |
| Anual | $39.000 CLP/año | 1 PC | Incluidas | 2 sesiones AnyDesk/año |
| Pro Anual | $69.000 CLP/año | 2 PCs | Incluidas | Sesiones ilimitadas |

---

## Fase 4 — Instalador Profesional

> El cliente no puede tener que ejecutar scripts técnicos. La instalación debe ser doble clic → siguiente → listo.

### 4.1 Herramienta recomendada: Inno Setup

Inno Setup es gratuito, genera instaladores `.exe` para Windows, y es la misma herramienta que usa la mayoría de los programas comerciales de escritorio.

**El instalador debe:**
- Tener el logo y nombre de FastPOS
- Mostrar los términos de licencia (que el cliente debe aceptar)
- Preguntar dónde instalar (con opción predeterminada en `C:\Program Files\FastPOS`)
- Instalar Node.js silenciosamente si no está presente (o usar la versión portable ya implementada)
- Instalar las dependencias (`node_modules`) durante la instalación
- Crear acceso directo en el Escritorio y en el menú Inicio
- Incluir un desinstalador (requerido para venta seria)

### 4.2 Distribución del instalador

- El instalador `.exe` se sube a un bucket de almacenamiento (Amazon S3, Cloudflare R2, o simplemente Google Drive público)
- El portal de ventas genera un enlace de descarga con token temporal (expira en 48 horas) que apunta a ese archivo
- El tamaño estimado del instalador final: 50–80 MB (incluye Node portable)

---

## Fase 5 — Portal de Ventas

> Página web simple donde el cliente conoce el producto, paga, y recibe su licencia.

### 5.1 Contenido mínimo del sitio

- **Inicio:** Qué es FastPOS, para quién es, capturas de pantalla
- **Precios:** Tabla con los planes (Básico, Anual, Pro)
- **Pago:** Integración con pasarela de pago
- **Descarga:** Página post-pago con enlace de descarga y clave de licencia
- **Soporte:** Instrucciones básicas y contacto

### 5.2 Pasarela de pago recomendada para Chile

- **Flow** (`flow.cl`) — acepta tarjetas de crédito/débito y transferencia bancaria en Chile, comisión ~2.95%
- **Stripe** — acepta tarjetas internacionales, útil si planeas vender fuera de Chile
- Ambas tienen integración simple via API REST y webhooks que activan la generación de licencias automáticamente

### 5.3 Automatización del flujo de venta

Cuando el cliente paga:
1. La pasarela envía un webhook al servidor de licencias
2. El servidor de licencias genera una clave única para ese cliente
3. Se envía automáticamente un email con la clave de licencia y el enlace de descarga
4. El cliente descarga, instala, activa, y empieza a usar FastPOS

Todo este proceso debe ocurrir sin intervención manual de tu parte.

---

## Fase 6 — Protocolo de Soporte Remoto

> Sin desarrollo adicional. Solo define cómo se presta el servicio.

### 6.1 Herramienta recomendada: AnyDesk

AnyDesk es gratuito para uso ocasional, no requiere instalación previa del cliente (puede ejecutarse sin instalar), y funciona desde Windows, Mac y celular.

**Ventajas sobre TeamViewer:**
- Más liviano
- No bloquea el uso comercial en el plan gratuito (TeamViewer sí lo hace)
- Conexión más rápida en Chile

### 6.2 Procedimiento de soporte

**Cuando el cliente solicita ayuda:**

1. El cliente abre AnyDesk en su PC (descarga gratuita en `anydesk.com` o ya instalado)
2. El cliente te envía por WhatsApp o email el código de 9 dígitos que aparece en pantalla
3. Tú ingresas ese código en tu AnyDesk y solicitas la conexión
4. El cliente acepta la conexión haciendo clic en **"Aceptar"**
5. Ves la pantalla del cliente en tiempo real y puedes controlar su PC
6. Al terminar, el cliente cierra AnyDesk y la sesión se corta automáticamente

**Tiempo estimado por sesión:** 5–30 minutos según el problema.

### 6.3 Casos de soporte más comunes y solución estimada

| Problema | Solución | Tiempo |
|----------|----------|--------|
| Olvidó su contraseña de admin | Conectarse por AnyDesk, editar `.env` o ejecutar reset | 5 min |
| "El programa no abre" | Verificar que el acceso directo apunta al lugar correcto | 5 min |
| Datos no se ven en Drive | Verificar configuración de `BACKUP_PATH` en `.env` | 10 min |
| Recuperación por disco dañado | Seguir pauta de recuperación ante desastre (Fase 2.4) | 30 min |
| Necesita instalar en PC nuevo | Nueva activación de licencia (Plan Pro) o compra nueva | 10 min |
| Error al emitir boleta/PDF | Verificar datos de empresa en Configuración | 10 min |

### 6.4 Límites del servicio de soporte

Definir claramente en los términos de venta qué incluye y qué no:

**Incluido:**
- Problemas con el funcionamiento del programa (bugs, errores)
- Recuperación de datos con Google Drive configurado
- Consultas sobre cómo usar las funciones del programa

**No incluido:**
- Problemas con el computador del cliente (Windows, antivirus, etc.)
- Recuperación de datos si no tenía Google Drive configurado
- Capacitación desde cero (se ofrece como servicio aparte)
- Modificaciones al programa (funciones nuevas a pedido)

---

## Cronograma Resumido

```
Semana 1     → Fase 0: Hardening (bcrypt, .env automático, Zod en fixedCosts/quotes)
Semana 2     → Fase 1: Build de producción + pruebas en máquina limpia
Semanas 3–4  → Fase 2: Módulo de respaldo + UI en ConfigurationView
Semanas 5–6  → Fase 3: Servidor de licencias + activación en FastPOS
Semana 7     → Fase 4: Instalador con Inno Setup
Semana 8     → Fase 5: Portal de ventas + integración con Flow
Semana 9     → QA final, prueba de venta completa de punta a punta
```

---

## Checklist de Lanzamiento

Antes de abrir las ventas, verificar:

- [ ] SHA-256 reemplazado por bcrypt
- [ ] `.env` automático sin fallbacks inseguros
- [ ] Build de producción funciona (`npm run build && npm run start`)
- [ ] Respaldo diario se genera correctamente en la ruta configurada
- [ ] Respaldo mensual se genera el primer día del mes
- [ ] Google Drive sincroniza el archivo en menos de 5 minutos
- [ ] Recuperación ante desastre probada en máquina limpia
- [ ] Sistema de licencias rechaza claves usadas en un segundo PC
- [ ] Instalador `.exe` funciona desde cero en PC sin Node.js
- [ ] Desinstalador elimina el programa correctamente
- [ ] Portal de ventas procesa un pago de prueba
- [ ] Email de licencia llega automáticamente tras el pago
- [ ] Enlace de descarga expira después de 48 horas
- [ ] Procedimiento de AnyDesk probado con un tercero
- [ ] Términos de licencia y política de soporte redactados

---

*Documento vivo — actualizar a medida que avanza la implementación.*
