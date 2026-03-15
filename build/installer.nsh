!macro customHeader
  !system "echo !define NSIS_PACKEDVERSION 1 > ${BUILD_RESOURCES_DIR}\packed.nsh"
!macroend

!macro preInit
  ; Cerrar todos los procesos de CajaGrit antes de iniciar
  nsExec::ExecToStack 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Pop $1
  Sleep 2000
!macroend

!macro customInit
  ; Cerrar procesos al iniciar el instalador
  nsExec::ExecToStack 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Pop $1
  Sleep 2000
!macroend

!macro customInstall
  ; Asegurar que no hay procesos corriendo durante la instalación
  nsExec::ExecToStack 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Pop $1
  Sleep 1500
!macroend

!macro customUnInit
  ; Cerrar al desinstalar
  nsExec::ExecToStack 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Pop $1
  Sleep 1000
!macroend
