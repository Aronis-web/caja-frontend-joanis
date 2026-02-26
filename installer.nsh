!macro customInit
  ; Cerrar la aplicación si está ejecutándose
  nsExec::Exec 'taskkill /F /IM CajaGrit.exe /T'
  nsExec::Exec 'taskkill /F /IM electron.exe /T'
  Sleep 2000

  ; Buscar y desinstalar versión anterior
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{f3980de2-3043-5cd9-b073-06816f0608de}" "UninstallString"
  ${If} $0 != ""
    DetailPrint "Desinstalando versión anterior..."
    ExecWait '"$0" /S _?=$INSTDIR'
    Sleep 2000
  ${EndIf}

  ; Buscar en HKLM también (instalaciones para todos los usuarios)
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{f3980de2-3043-5cd9-b073-06816f0608de}" "UninstallString"
  ${If} $0 != ""
    DetailPrint "Desinstalando versión anterior (sistema)..."
    ExecWait '"$0" /S _?=$INSTDIR'
    Sleep 2000
  ${EndIf}
!macroend
