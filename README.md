# FastPOS Libre y Local

Este proyecto es un sistema de Punto de Venta (POS) rápido y eficiente, preparado para usarse localmente de manera sencilla. Ahora es completamente de código abierto bajo la Licencia **GPLv3**.

## Características
- Fácil de usar e instalar.
- Base de datos 100% local (SQLite).
- Despliegue con React, Vite y Express.

## Instalación y Ejecución

**Requisitos previos:** Debes tener instalado [Node.js](https://nodejs.org/) (recomendado la versión LTS).

### Opción 1: Scripts de Acceso Rápido (Recomendado para Windows)

1. Clona o descarga este repositorio e instala las dependencias:
   ```bash
   git clone https://github.com/MatiasBalbontin/FastPOS
   cd fastpos
   npm install
   ```
2. Haz doble clic en el script `CrearAccesoDirecto.vbs`.
   Esto automáticamente creará un acceso directo en tu Escritorio, que arrancará la aplicación y abrirá tu navegador. ¡Es todo!

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
