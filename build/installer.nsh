!include LogicLib.nsh

!macro customHeader
  !system "echo !define NSIS_PACKEDVERSION 1 > ${BUILD_RESOURCES_DIR}\packed.nsh"
!macroend

; Para oneClick, usamos customInit que se ejecuta muy temprano
!macro customInit
  SetShellVarContext current
  DetailPrint "Preparando instalación de CajaGrit..."
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  nsExec::Exec 'taskkill /F /IM "electron.exe" /T'
  Pop $0
  Sleep 1500
!macroend

!macro customCheckAppRunning
  ; Override del check por defecto de electron-builder para evitar falso positivo
  ; "CajaGrit cannot be closed" cuando no hay proceso real.
  DetailPrint "Verificando y cerrando procesos de CajaGrit..."

  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  nsExec::Exec 'taskkill /F /IM "electron.exe" /T'
  Pop $0
  Sleep 2000

  ; Si hubiera procesos huérfanos del mismo EXE, reintenta una vez más
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
  SetShellVarContext current

  StrCpy $R8 "$DESKTOP\CajaGrit_Install_Log.txt"
  FileOpen $R9 $R8 a
  FileWrite $R9 "[customInstall] Archivos instalados exitosamente$\r$\n"
  FileWrite $R9 "[customInstall] Ubicacion: $INSTDIR$\r$\n"
  FileWrite $R9 "=== Instalacion Completada ===$\r$\n"
  FileClose $R9
!macroend
