Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strCurrentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' El "0" indica que la ventana del .bat se ejecutará totalmente oculta
WshShell.Run chr(34) & strCurrentDir & "\IniciarFastPOS.bat" & Chr(34), 0, False
