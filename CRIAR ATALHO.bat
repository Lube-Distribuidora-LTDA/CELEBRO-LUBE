@echo off
rem ===========================================================================
rem  Cerebro da Lube - cria o atalho Ctrl+Alt+J que chama o Jarvis.
rem  Cria "Jarvis da Lube" no menu Iniciar (o atalho de teclado do Windows so
rem  vale para atalho no menu Iniciar ou na Area de Trabalho). O atalho roda o
rem  ferramentas\chamar-jarvis.ps1: liga o app se estiver desligado e abre o
rem  Jarvis; se ja estiver ligado, traz a janela para a frente.
rem  Rodar de novo recria o atalho. Para desfazer: apague o atalho
rem  "Jarvis da Lube" do menu Iniciar.
rem ===========================================================================
setlocal
cd /d "%~dp0"
if not exist "%~dp0ferramentas\chamar-jarvis.ps1" (
  echo.
  echo   Nao achei o ferramentas\chamar-jarvis.ps1 nesta pasta.
  echo.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ferramentas\chamar-jarvis.ps1" -CriarAtalho
if errorlevel 1 (
  echo.
  echo   Nao consegui criar o atalho.
)
echo.
pause
