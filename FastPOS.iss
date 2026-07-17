; Script de Inno Setup para generar el instalador de FastPOS v1.2
; Descarga gratuita de Inno Setup en https://jrsoftware.org/isdl.php

[Setup]
AppName=FastPOS
AppVersion=1.2.0
AppPublisher=Matías Balbontín
DefaultDirName={autopf}\FastPOS
DefaultGroupName=FastPOS
DisableProgramGroupPage=yes
LicenseFile=LICENSE
; El archivo del instalador de salida se colocará en la raíz del proyecto
OutputDir=.
OutputBaseFilename=Instalador_FastPOS_v1.2
SetupIconFile=fastpos.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Copiar todos los archivos compilados del sistema
Source: "IniciarFastPOS.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "LanzadorOculto.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "fastpos.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "index.html"; DestDir: "{app}"; Flags: ignoreversion
; NO se empaqueta .env: server.ts lo autogenera en el primer arranque de cada
; instalación, con una contraseña de admin y un SESSION_SECRET únicos por cliente.

; Copiar carpetas del sistema (solo lo necesario para correr en producción —
; NO se incluye src/, tsconfig.json ni vite.config.ts: son fuente de desarrollo,
; ya compilada dentro de dist/, y no deben viajar al PC del cliente)
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs

; node_modules de producción ya instalados antes de compilar (ver Paso 4a):
; cd FastPOS && npm install --production
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

; Node.js portable — necesario porque el cliente no tiene Node instalado.
; Debe existir FastPOS\.node\ con un Node.js portable (node.exe + npm) antes de compilar.
Source: ".node\*"; DestDir: "{app}\.node"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: HasLocalNode

[Icons]
Name: "{group}\FastPOS"; Filename: "{app}\LanzadorOculto.vbs"; IconFilename: "{app}\fastpos.ico"
Name: "{group}\{cm:UninstallProgram,FastPOS}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\FastPOS"; Filename: "{app}\LanzadorOculto.vbs"; IconFilename: "{app}\fastpos.ico"; Tasks: desktopicon

[Code]
function HasLocalNode: Boolean;
begin
  Result := DirExists(ExpandConstant('{src}\.node'));
end;
