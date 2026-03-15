; Script NSIS personalizado para cerrar la aplicación antes de instalar/actualizar

!macro customInit
  ; Cerrar la aplicación si está en ejecución antes de instalar
  ${ifNot} ${isUpdated}
    ; Buscar y cerrar el proceso CajaGrit.exe
    nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
    Pop $0

    ; Esperar un momento para que el proceso se cierre completamente
    Sleep 1000
  ${endIf}
!macroend

!macro customInstall
  ; Cerrar la aplicación si está en ejecución durante la instalación
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0

  ; Esperar un momento para que el proceso se cierre completamente
  Sleep 1000
!macroend

!macro preInit
  ; Cerrar la aplicación antes de que comience la instalación
  nsExec::Exec 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Sleep 500
!macroend
