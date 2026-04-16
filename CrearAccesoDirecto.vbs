Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set fso = CreateObject("Scripting.FileSystemObject")
strCurrentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Ejecutar instalador de dependencias sincrónicamente
If Not fso.FolderExists(strCurrentDir & "\node_modules") Then
    MsgBox "FastPOS necesita instalar las dependencias base y de excel por primera vez. Esto tomará unos momentos y requiere conexión a internet.", 64, "Instalación Inicial"
    WshShell.Run "cmd.exe /c cd /d """ & strCurrentDir & """ && npm install --no-fund && npm install xlsx kill-port --save", 1, True
End If

Set oShellLink = WshShell.CreateShortcut(strDesktop & "\FastPOS.lnk")
oShellLink.TargetPath = "wscript.exe"
oShellLink.Arguments = Chr(34) & strCurrentDir & "\LanzadorOculto.vbs" & Chr(34)
oShellLink.WindowStyle = 1
oShellLink.Description = "Sistema de Punto de Venta Local"
oShellLink.WorkingDirectory = strCurrentDir
' Establecer el ícono personalizado (debe estar en formato .ico en la carpeta public)
oShellLink.IconLocation = strCurrentDir & "\public\fastpos.ico"
oShellLink.Save

MsgBox "Acceso directo 'FastPOS' creado exitosamente en tu Escritorio." & vbCrLf & "Puedes abrir la aplicación sin internet de ahora en adelante.", 64, "FastPOS Setup"
