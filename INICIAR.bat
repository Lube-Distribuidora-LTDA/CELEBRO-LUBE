@echo off
rem ===========================================================================
rem  Cerebro da Lube - liga o app local (painel do robo + Jarvis) e abre o Edge
rem  em janela de app. So este computador enxerga (127.0.0.1:8790).
rem  Feche esta janela para desligar.
rem ===========================================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Falta o Node.js neste computador. Instale a versao LTS em https://nodejs.org e rode de novo.
  echo.
  pause
  exit /b 1
)

rem --- o ENV (credenciais) fica nesta pasta, ao lado deste arquivo; o Git ignora
if exist "%~dp0ENV" goto :env_ok
echo.
echo   Nao achei o ENV (credenciais) nesta pasta.
echo   Sem ele o Jarvis liga com o cerebro de teste (frases prontas), sem banco e sem e-mail.
echo.
choice /c SN /m "  Criar o ENV agora a partir do ENV.example e abrir no Bloco de Notas"
if errorlevel 2 goto :env_ok
copy /y "%~dp0ENV.example" "%~dp0ENV" >nul
start "" notepad "%~dp0ENV"
echo.
echo   Preencha o ENV, salve, feche o Bloco de Notas e aperte uma tecla para continuar.
pause >nul
:env_ok

if not exist "%~dp0servidor\node_modules" (
  echo   Primeira vez neste computador: instalando as bibliotecas do servidor...
  pushd "%~dp0servidor"
  call npm install --omit=dev --no-audit --no-fund
  popd
)

echo.
echo   Cerebro da Lube em http://localhost:8790 - a janela do Edge abre sozinha.
echo   Para desligar, feche esta janela.
echo.
node "%~dp0servidor\servidor.js" --abrir
pause
