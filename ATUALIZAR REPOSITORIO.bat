@echo off
rem ===========================================================================
rem  Cerebro da Lube - copia o vault do OneDrive para esta pasta (vault\),
rem  confere segredos, faz o commit e sobe para o GitHub (so se o repositorio
rem  for privado). Detalhes no README.md, secao "Backup do vault".
rem ===========================================================================
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Falta o Python neste computador.
  echo.
  pause
  exit /b 1
)

python -I -X utf8 "%~dp0ferramentas\atualizar_repositorio.py" %*
echo.
pause
