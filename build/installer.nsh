!include LogicLib.nsh

!macro customHeader
  !system "echo !define NSIS_PACKEDVERSION 1 > ${BUILD_RESOURCES_DIR}\packed.nsh"
!macroend

; Para oneClick, usamos customInit que se ejecuta muy temprano
!macro customInit
  SetShellVarContext current

  ; Crear log
  StrCpy $R8 "$DESKTOP\CajaGrit_Install_Log.txt"
  FileOpen $R9 $R8 w
  FileWrite $R9 "=== CajaGrit Installation Log v0.0.24 (OneClick) ===$\r$\n"
  FileWrite $R9 "[customInit] Instalacion OneClick iniciada$\r$\n"
  FileWrite $R9 "[customInit] Directorio: $INSTDIR$\r$\n"

  ; Cerrar proceso CajaGrit.exe
  FileWrite $R9 "[customInit] Cerrando CajaGrit.exe...$\r$\n"
  nsExec::ExecToStack 'taskkill /F /IM "CajaGrit.exe" /T'
  Pop $0
  Pop $1
  FileWrite $R9 "[customInit] Taskkill Exit Code: $0$\r$\n"
  FileWrite $R9 "[customInit] Taskkill Output: $1$\r$\n"

  Sleep 3000
  FileWrite $R9 "[customInit] Esperando 3 segundos...$\r$\n"

  ; Verificar si el directorio existe y renombrarlo
  IfFileExists "$INSTDIR\*.*" 0 dir_not_exists
    FileWrite $R9 "[customInit] Directorio existe, renombrando...$\r$\n"

    ; Renombrar directorio antiguo
    Rename "$INSTDIR" "$INSTDIR.old"
    IfFileExists "$INSTDIR.old\*.*" 0 rename_failed
      FileWrite $R9 "[customInit] Directorio renombrado a .old$\r$\n"
      ; Programar eliminación al reiniciar
      Delete /REBOOTOK "$INSTDIR.old\*.*"
      RMDir /r /REBOOTOK "$INSTDIR.old"
      FileWrite $R9 "[customInit] Programado para eliminar al reiniciar$\r$\n"
      Goto dir_done

    rename_failed:
      FileWrite $R9 "[customInit] ERROR: No se pudo renombrar$\r$\n"
      ; Intentar eliminar directamente
      Delete /REBOOTOK "$INSTDIR\*.*"
      RMDir /r /REBOOTOK "$INSTDIR"
      FileWrite $R9 "[customInit] Programado eliminacion directa$\r$\n"
      Goto dir_done

  dir_not_exists:
    FileWrite $R9 "[customInit] Directorio no existe (nueva instalacion)$\r$\n"

  dir_done:
  FileWrite $R9 "[customInit] Completado$\r$\n$\r$\n"
  FileClose $R9
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
