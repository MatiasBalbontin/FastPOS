@echo off
title Servidor FastPOS
echo ==================================================
echo.           Iniciando FastPOS Localmente
echo ==================================================
echo.
cd /d "%~dp0"

:: 1. Verificando entorno Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if not exist ".node\node.exe" (
        echo [!] Descargando entorno Node.js portable silente ^(Por favor espera unos minutos...^)
        if not exist ".node" mkdir ".node"
        powershell -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip' -OutFile '.node\node.zip'"
        echo [!] Extrayendo archivos...
        powershell -Command "Expand-Archive -Path '.node\node.zip' -DestinationPath '.node' -Force"
        xcopy /E /Y ".node\node-v20.11.1-win-x64\*" ".node\" >nul
        rmdir /s /q ".node\node-v20.11.1-win-x64"
        del ".node\node.zip"
    )
    :: Agregando el node local al PATH de esta sesión de CMD temporalmente
    set "PATH=%~dp0.node;%PATH%"
)

echo [1/3] Verificando dependencias...
if not exist "node_modules\" (
    echo Instalando dependencias del sistema... ^(Se requiere internet solo la primera vez^)
    call npm install --no-fund
) else (
    echo Dependencias locales encontradas. Listo para uso sin internet.
)

echo Limpiando puertos en uso para inicio limpio...
call npx -y kill-port 3000 >nul 2>&1

echo [2/3] Abriendo el navegador...
:: Esperar 3 segundos para que el servidor alcance a iniciar y abrir el local
start http://localhost:3000

echo [3/3] Arrancando el sistema servidor...
echo IMPORTANTE: No cierres esta ventana mientras uses el sistema.
echo.
call npm run dev
