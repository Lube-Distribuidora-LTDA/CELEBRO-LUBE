@echo off
rem Jarvis de TESTE (para o Claude testar no navegador do app): cérebro simulado, trava do rosto aberta (cadastro
rem numa pasta temporária, nunca o de verdade) e porta 8791, para não atrapalhar o app do Júlio na 8790.
rem Usado pela configuração "jarvis-teste" do .claude/launch.json do vault. Abra com ?jarvis=simular&debug.
set JARVIS_PORTA=8791
rem A pasta do Jarvis, o perfil do navegador e o gasto do construtor do teste ficam em %TEMP%\cerebro-jarvis-teste
rem (uma pasta só, reaproveitada; nunca o OneDrive\JARVIS de verdade). Apagar essa pasta zera o teste.
node "%~dp0..\servidor\servidor.js" --simulado --trava-aberta "--teste-pasta=%TEMP%\cerebro-jarvis-teste"
