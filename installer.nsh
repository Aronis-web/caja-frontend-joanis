!include LogicLib.nsh

!macro customInit
  ; Cierre preventivo temprano
  DetailPrint "Cerrando CajaGrit si está en ejecución..."
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  nsExec::Exec 'taskkill /F /IM "electron.exe" /T'
  Pop $0
  Sleep 1500
!macroend

; Hook exacto usado por electron-builder antes de extraer/reemplazar archivos
!macro customCheckAppRunning
  ; Override del check por defecto de electron-builder para evitar falso positivo
  DetailPrint "Verificando y cerrando procesos de CajaGrit..."

  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  nsExec::Exec 'taskkill /F /IM "electron.exe" /T'
  Pop $0
  Sleep 2000

  ; Reintento preventivo
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Sleep 1200
!macroend

!macro customUnInstallCheck
  ; Evita falso positivo de "appCannotBeClosed" durante desinstalación previa.
  ; Cerramos procesos conocidos y continuamos sin mostrar popup bloqueante.
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  nsExec::Exec 'taskkill /F /IM "electron.exe" /T'
  Pop $0
  Sleep 1500
!macroend

!macro customUnInstallCheckCurrentUser
  ; Mismo comportamiento para instalaciones por usuario actual.
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  nsExec::Exec 'taskkill /F /IM "electron.exe" /T'
  Pop $0
  Sleep 1500
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
