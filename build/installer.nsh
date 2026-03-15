; Script NSIS personalizado para cerrar la aplicación antes de instalar/actualizar

!macro customInit
  ; Intentar cerrar la aplicación de forma amigable primero
  nsExec::Exec 'taskkill /IM "CajaGrit.exe"'
  Pop $0
  Sleep 2000

  ; Si aún está corriendo, forzar el cierre
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Sleep 1000
!macroend

!macro customInstall
  ; Cerrar todos los procesos relacionados
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Sleep 1500
!macroend

!macro preInit
  ; Cerrar antes de iniciar la instalación
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Sleep 1000
!macroend

!macro customUnInit
  ; Cerrar al desinstalar
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Sleep 1000
!macroend
