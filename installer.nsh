!macro customInit
  ; Cerrar la aplicación si está ejecutándose
  nsExec::Exec 'taskkill /F /IM CajaGrit.exe /T'
  Pop $0
  nsExec::Exec 'taskkill /F /IM electron.exe /T'
  Pop $0
  Sleep 2000

  ; Buscar y desinstalar versión anterior en HKCU
  ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{f3980de2-3043-5cd9-b073-06816f0608de}" "UninstallString"
  ${If} $1 != ""
    DetailPrint "Desinstalando versión anterior..."
    ; Extraer la ruta del desinstalador
    StrCpy $2 $1 "" 1 ; Remover comillas
    StrCpy $2 $2 -1
    ExecWait '"$2" /S'
    Sleep 3000
    ; Eliminar carpeta residual si existe
    ${If} ${FileExists} "$LOCALAPPDATA\Programs\CajaGrit\*.*"
      RMDir /r "$LOCALAPPDATA\Programs\CajaGrit"
    ${EndIf}
  ${EndIf}

  ; Buscar en HKLM también (instalaciones para todos los usuarios)
  ReadRegStr $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{f3980de2-3043-5cd9-b073-06816f0608de}" "UninstallString"
  ${If} $1 != ""
    DetailPrint "Desinstalando versión anterior (sistema)..."
    StrCpy $2 $1 "" 1
    StrCpy $2 $2 -1
    ExecWait '"$2" /S'
    Sleep 3000
    ; Eliminar carpeta residual si existe
    ${If} ${FileExists} "$PROGRAMFILES\CajaGrit\*.*"
      RMDir /r "$PROGRAMFILES\CajaGrit"
    ${EndIf}
  ${EndIf}
!macroend
