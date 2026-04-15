Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set fso = CreateObject("Scripting.FileSystemObject")
strCurrentDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set oShellLink = WshShell.CreateShortcut(strDesktop & "\FastPOS.lnk")
oShellLink.TargetPath = "wscript.exe"
oShellLink.Arguments = Chr(34) & strCurrentDir & "\LanzadorOculto.vbs" & Chr(34)
oShellLink.WindowStyle = 1
oShellLink.Description = "Sistema de Punto de Venta Local"
oShellLink.WorkingDirectory = strCurrentDir
' Establecer el ícono personalizado (debe estar en formato .ico en la carpeta public)
oShellLink.IconLocation = strCurrentDir & "\public\fastpos.ico"
oShellLink.Save

MsgBox "Acceso directo 'FastPOS' creado exitosamente en tu Escritorio.", 64, "FastPOS Setup"
