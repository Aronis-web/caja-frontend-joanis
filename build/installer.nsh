!macro customHeader
  !system "echo !define NSIS_PACKEDVERSION 1 > ${BUILD_RESOURCES_DIR}\packed.nsh"
!macroend

!macro preInit
  ; Crear archivo de log en el escritorio
  FileOpen $R9 "$DESKTOP\CajaGrit_Install_Log.txt" w
  FileWrite $R9 "=== CajaGrit Installation Log ===$\r$\n"
  FileWrite $R9 "Timestamp: $\r$\n"
  FileWrite $R9 "$\r$\n"

  FileWrite $R9 "[preInit] Iniciando preInit macro...$\r$\n"

  ; Verificar si el proceso está corriendo
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq CajaGrit.exe"'
  Pop $0
  Pop $1
  FileWrite $R9 "[preInit] Verificación de proceso - Exit Code: $0$\r$\n"
  FileWrite $R9 "[preInit] Procesos encontrados: $1$\r$\n"

  ; Cerrar todos los procesos de CajaGrit antes de iniciar
  FileWrite $R9 "[preInit] Ejecutando taskkill...$\r$\n"
  nsExec::ExecToStack 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Pop $1
  FileWrite $R9 "[preInit] Taskkill Exit Code: $0$\r$\n"
  FileWrite $R9 "[preInit] Taskkill Output: $1$\r$\n"

  Sleep 2000
  FileWrite $R9 "[preInit] Esperando 2000ms...$\r$\n"

  ; Verificar nuevamente
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq CajaGrit.exe"'
  Pop $0
  Pop $1
  FileWrite $R9 "[preInit] Verificación post-kill: $1$\r$\n"
  FileWrite $R9 "[preInit] Completado.$\r$\n$\r$\n"

  FileClose $R9
!macroend

!macro customInit
  ; Continuar escribiendo en el log
  FileOpen $R9 "$DESKTOP\CajaGrit_Install_Log.txt" a
  FileWrite $R9 "[customInit] Iniciando customInit macro...$\r$\n"

  ; Verificar si el proceso está corriendo
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq CajaGrit.exe"'
  Pop $0
  Pop $1
  FileWrite $R9 "[customInit] Verificación de proceso - Exit Code: $0$\r$\n"
  FileWrite $R9 "[customInit] Procesos encontrados: $1$\r$\n"

  ; Cerrar procesos al iniciar el instalador
  FileWrite $R9 "[customInit] Ejecutando taskkill...$\r$\n"
  nsExec::ExecToStack 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Pop $1
  FileWrite $R9 "[customInit] Taskkill Exit Code: $0$\r$\n"
  FileWrite $R9 "[customInit] Taskkill Output: $1$\r$\n"

  Sleep 2000
  FileWrite $R9 "[customInit] Esperando 2000ms...$\r$\n"
  FileWrite $R9 "[customInit] Completado.$\r$\n$\r$\n"

  FileClose $R9
!macroend

!macro customInstall
  ; Continuar escribiendo en el log
  FileOpen $R9 "$DESKTOP\CajaGrit_Install_Log.txt" a
  FileWrite $R9 "[customInstall] Iniciando customInstall macro...$\r$\n"
  FileWrite $R9 "[customInstall] Directorio de instalación: $INSTDIR$\r$\n"

  ; Verificar si el proceso está corriendo
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq CajaGrit.exe"'
  Pop $0
  Pop $1
  FileWrite $R9 "[customInstall] Verificación de proceso - Exit Code: $0$\r$\n"
  FileWrite $R9 "[customInstall] Procesos encontrados: $1$\r$\n"

  ; Asegurar que no hay procesos corriendo durante la instalación
  FileWrite $R9 "[customInstall] Ejecutando taskkill...$\r$\n"
  nsExec::ExecToStack 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Pop $1
  FileWrite $R9 "[customInstall] Taskkill Exit Code: $0$\r$\n"
  FileWrite $R9 "[customInstall] Taskkill Output: $1$\r$\n"

  Sleep 1500
  FileWrite $R9 "[customInstall] Esperando 1500ms...$\r$\n"
  FileWrite $R9 "[customInstall] Completado.$\r$\n$\r$\n"

  FileClose $R9
!macroend

!macro customUnInit
  ; Continuar escribiendo en el log
  FileOpen $R9 "$DESKTOP\CajaGrit_Install_Log.txt" a
  FileWrite $R9 "[customUnInit] Iniciando customUnInit macro...$\r$\n"

  ; Cerrar al desinstalar
  FileWrite $R9 "[customUnInit] Ejecutando taskkill...$\r$\n"
  nsExec::ExecToStack 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Pop $1
  FileWrite $R9 "[customUnInit] Taskkill Exit Code: $0$\r$\n"
  FileWrite $R9 "[customUnInit] Taskkill Output: $1$\r$\n"

  Sleep 1000
  FileWrite $R9 "[customUnInit] Esperando 1000ms...$\r$\n"
  FileWrite $R9 "[customUnInit] Completado.$\r$\n$\r$\n"
  FileWrite $R9 "=== Instalación Finalizada ===$\r$\n"

  FileClose $R9
!macroend
