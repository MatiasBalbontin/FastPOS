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
Source: "tsconfig.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "vite.config.ts"; DestDir: "{app}"; Flags: ignoreversion
Source: "index.html"; DestDir: "{app}"; Flags: ignoreversion

; Copiar carpetas del sistema
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs

; Nota: Excluimos node_modules del empaquetado para reducir peso y los instalamos durante el setup,
; o el instalador puede copiar la versión portable de Node.js si existe en la carpeta .node/
Source: ".node\*"; DestDir: "{app}\.node"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: HasLocalNode

[Icons]
Name: "{group}\FastPOS"; Filename: "{app}\LanzadorOculto.vbs"; IconFilename: "{app}\fastpos.ico"
Name: "{group}\{cm:UninstallProgram,FastPOS}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\FastPOS"; Filename: "{app}\LanzadorOculto.vbs"; IconFilename: "{app}\fastpos.ico"; Tasks: desktopicon

[Run]
; Ejecutar npm install de forma silenciosa al finalizar para instalar dependencias locales
Filename: "cmd.exe"; Parameters: "/c npm install --production --no-fund"; WorkingDir: "{app}"; StatusMsg: "Instalando dependencias de Node.js locales (por favor espera)..."; Flags: runhidden

[Code]
function HasLocalNode: Boolean;
begin
  Result := DirExists(ExpandConstant('{src}\.node'));
end;
