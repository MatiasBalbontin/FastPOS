# FastPOS Libre y Local

Este proyecto es un sistema de Punto de Venta (POS) rápido y eficiente, preparado para usarse localmente de manera sencilla. Ahora es completamente de código abierto bajo la Licencia **GPLv3**.

## Características
- Fácil de usar e instalar.
- Base de datos 100% local (SQLite).
- Despliegue con React, Vite y Express.

## Instalación y Ejecución

**Requisitos previos (Mac/Linux):** Debes tener instalado [Node.js](https://nodejs.org/) (recomendado la versión LTS). **¡En Windows ya no es necesario instalarlo manualmente!**

### Opción 1: Instalación de 1 Clic (Recomendado para Windows)

1. Clona o descarga este repositorio y entra a la carpeta:
   ```bash
   git clone https://github.com/MatiasBalbontin/FastPOS.git
   cd fastpos
   ```
2. Simplemente haz doble clic en el archivo **`CrearAccesoDirecto.vbs`**.
   *¿Qué hará esto?* 
   - Detectará automáticamente si tienes NodeJS. Si no lo tienes, **descargará e instalará uno portátil y silencioso** dentro de la carpeta.
   - Instalará todas las dependencias del sistema.
   - Creará un acceso directo permanente en tu Escritorio para uso diario.

### Opción 2: Ejecución Manual en Terminal / Otro Sistema Operativo

1. Clonar este proyecto en tu dispositivo:
   ```bash
   git clone (https://github.com/MatiasBalbontin/FastPOS)
   cd fastpos
   ```
2. Instalar las dependencias de Node.js:
   ```bash
   npm install
   ```
3. Ejecutar la aplicación:
   ```bash
   npm run dev
   ```
   Finalmente, abre el explorador que se indique en la terminal (ej: `http://localhost:3000`).

---

**Licencia:**
Distribuido bajo la licencia GPLv3. Ver el archivo `LICENSE` para más detalles.
