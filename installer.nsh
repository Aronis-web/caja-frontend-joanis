!macro customInit
  ; Cerrar la aplicación si está ejecutándose
  DetailPrint "Cerrando CajaGrit si está en ejecución..."
  nsExec::Exec 'taskkill /F /IM CajaGrit.exe /T'
  Pop $0
  nsExec::Exec 'taskkill /F /IM electron.exe /T'
  Pop $0
  Sleep 3000

  DetailPrint "Preparando instalación..."
!macroend

!macro customInstall
  ; Después de instalar, limpiar archivos antiguos si existen
  DetailPrint "Limpiando archivos antiguos..."

  ; Eliminar instalaciones antiguas en otras ubicaciones
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\CajaGrit\CajaGrit.exe"
    ${If} "$INSTDIR" != "$LOCALAPPDATA\Programs\CajaGrit"
      RMDir /r "$LOCALAPPDATA\Programs\CajaGrit"
    ${EndIf}
  ${EndIf}

  ${If} ${FileExists} "$PROGRAMFILES\CajaGrit\CajaGrit.exe"
    ${If} "$INSTDIR" != "$PROGRAMFILES\CajaGrit"
      RMDir /r "$PROGRAMFILES\CajaGrit"
    ${EndIf}
  ${EndIf}
!macroend
