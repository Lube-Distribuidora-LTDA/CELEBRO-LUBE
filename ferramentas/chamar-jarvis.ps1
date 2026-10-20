# Cérebro da Lube — ferramentas/chamar-jarvis.ps1
# O atalho Ctrl+Alt+J chama este arquivo (o "Jarvis da Lube" do menu Iniciar, que o CRIAR ATALHO.bat cria).
#  1. O app está ligado (porta 8790 respondendo)? Não: liga pelo INICIAR.bat, minimizado, com CEREBRO_ABRIR=jarvis
#     (o servidor abre o Edge já no Jarvis).
#  2. Sim: avisa o app (POST /api/jarvis/chamar com a chave do atalho, que o servidor grava a cada partida em
#     %LOCALAPPDATA%\CerebroLube\atalho.chave) e traz a janela do Cérebro para a frente; sem janela, abre uma.
# Com -CriarAtalho, só cria (ou recria) o atalho no menu Iniciar. Nunca grava senha, token nem chave em lugar nenhum:
# a chave do atalho é lida do arquivo e vai só no cabeçalho do pedido para 127.0.0.1.
# Este arquivo fica em UTF-8 com BOM (o PowerShell 5.1 lê acento errado sem ele).
param(
  [switch]$CriarAtalho,
  [int]$Porta = 8790
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:$Porta/#jarvis"

function Achar-Edge {
  foreach ($p in @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")) {
    if ($p -and (Test-Path -LiteralPath $p)) { return $p }
  }
  return $null
}

if ($CriarAtalho) {
  $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $destino = Join-Path ([Environment]::GetFolderPath('Programs')) 'Jarvis da Lube.lnk'
  $w = New-Object -ComObject WScript.Shell
  $s = $w.CreateShortcut($destino)
  $s.TargetPath = $ps
  $s.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $PSCommandPath + '"'
  $s.WorkingDirectory = $repo
  $s.Hotkey = 'CTRL+ALT+J'
  $s.WindowStyle = 7          # minimizada: a janela do PowerShell quase não aparece
  $s.Description = 'Chama o Jarvis da Lube (Ctrl+Alt+J)'
  $edge = Achar-Edge
  if ($edge) { $s.IconLocation = $edge + ',0' }
  $s.Save()
  Write-Host ''
  Write-Host '  Pronto: o atalho "Jarvis da Lube" está no menu Iniciar, com Ctrl+Alt+J.'
  Write-Host ('  Arquivo: ' + $destino)
  Write-Host '  Para desfazer: apague o atalho "Jarvis da Lube" do menu Iniciar (ou esse arquivo).'
  Write-Host '  Se o Ctrl+Alt+J não responder logo, saia e entre de novo no Windows.'
  exit 0
}

# 1. o app está ligado?
function Porta-Aberta {
  $c = New-Object System.Net.Sockets.TcpClient
  try {
    $t = $c.BeginConnect('127.0.0.1', $Porta, $null, $null)
    if (-not $t.AsyncWaitHandle.WaitOne(300)) { return $false }
    $c.EndConnect($t)
    return $true
  } catch { return $false } finally { $c.Close() }
}

if (-not (Porta-Aberta)) {
  $bat = Join-Path $repo 'INICIAR.bat'
  if (-not (Test-Path -LiteralPath $bat)) { exit 1 }
  $env:CEREBRO_ABRIR = 'jarvis'
  Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\cmd.exe') -ArgumentList ('/c ""' + $bat + '""') -WorkingDirectory $repo -WindowStyle Minimized
  exit 0
}

# 2. ligado: avisa o app (a tela abre o Jarvis) — sem proxy, só 127.0.0.1
$arqChave = Join-Path $env:LOCALAPPDATA 'CerebroLube\atalho.chave'
$chave = $null
try { $chave = ([System.IO.File]::ReadAllText($arqChave)).Trim() } catch { $chave = $null }
if ($chave) {
  try {
    $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$Porta/api/jarvis/chamar")
    $req.Method = 'POST'
    $req.Proxy = $null
    $req.Timeout = 3000
    $req.ContentType = 'application/json'
    $req.Headers.Add('x-cerebro-atalho', $chave)
    $corpo = [System.Text.Encoding]::UTF8.GetBytes('{}')
    $req.ContentLength = $corpo.Length
    $fluxo = $req.GetRequestStream(); $fluxo.Write($corpo, 0, $corpo.Length); $fluxo.Close()
    $resp = $req.GetResponse(); $resp.Close()
  } catch { }
}

# traz a janela do Cérebro para a frente (o título da página é "Cérebro da Lube"); minimizada, restaura antes
$janela = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like '*rebro da Lube*' } | Select-Object -First 1
if ($janela) {
  try {
    Add-Type -Namespace CerebroLube -Name Janela -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int n);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
'@
    if ([CerebroLube.Janela]::IsIconic($janela.MainWindowHandle)) { [void][CerebroLube.Janela]::ShowWindowAsync($janela.MainWindowHandle, 9) }
    [void][CerebroLube.Janela]::SetForegroundWindow($janela.MainWindowHandle)
  } catch { }
  try { [void](New-Object -ComObject WScript.Shell).AppActivate($janela.Id) } catch { }
  exit 0
}
$edge = Achar-Edge
if ($edge) { Start-Process -FilePath $edge -ArgumentList ('--app=' + $url) }
else { Start-Process -FilePath $url }
exit 0
