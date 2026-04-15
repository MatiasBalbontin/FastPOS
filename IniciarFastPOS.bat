@echo off
title Servidor FastPOS
echo ==================================================
echo.           Iniciando FastPOS Localmente
echo ==================================================
echo.
cd /d "%~dp0"

echo [1/3] Verificando dependencias...
call npm install --no-fund --silent >nul 2>&1

echo Limpiando puertos en uso para inicio limpio...
call npx -y kill-port 3000 >nul 2>&1

echo [2/3] Abriendo el navegador...
:: Esperar 3 segundos para que el servidor alcance a iniciar y abrir el local
start http://localhost:3000

echo [3/3] Arrancando el sistema servidor...
echo IMPORTANTE: No cierres esta ventana mientras uses el sistema.
echo.
call npm run dev
