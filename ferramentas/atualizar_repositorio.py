"""Cérebro da Lube — copia o vault para o repositório e sobe para o GitHub (backup).

Uso:  python -I -X utf8 ferramentas/atualizar_repositorio.py [--autor claude] [--sem-push]
      (ou o ATUALIZAR REPOSITORIO.bat da raiz)

O que faz, nesta ordem (para no primeiro problema, sem subir nada):
 1. Espelha o vault do OneDrive (CEREBRO DA LUBE) em vault/ deste repositório. Ficam de fora o estado da janela do
    Obsidian (.obsidian/workspace*.json), a lixeira (.trash/), pastas .git e as notas com dado de pessoa (lista em
    ferramentas/fora_do_repositorio.txt ou "repositorio: nao" no frontmatter), pela regra "dado de pessoa não vai
    para o repositório". O que sai do vault sai da cópia; o histórico do Git guarda as versões antigas.
 2. Confere segredo em tudo o que vai para o Git: formatos de chave e senha (sk-ant-, JWT, token do GitHub e do
    Telegram, postgres://usuario:senha@, chave privada, "senha: ...") e, mais forte, se alguma senha ou chave REAL do
    ENV desta pasta aparece em algum arquivo (inclusive dentro de .xlsx/.docx). Nenhum valor é impresso: só o arquivo,
    a linha e o tipo.
 3. Commit (só se algo mudou).
 4. Push, mas SÓ se o repositório do GitHub não for público. O vault tem a descrição da infraestrutura interna e de
    falhas de segurança: num repositório público qualquer pessoa leria. Com o repositório público o commit fica só
    aqui, e o script avisa.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "vault"
VAULT = Path(os.environ.get("CEREBRO_VAULT") or Path.home() / "OneDrive - Lube" / "CEREBRO DA LUBE")
FORA = [re.compile(p) for p in (r"^\.obsidian/workspace[^/]*\.json$", r"^\.trash/", r"(^|/)\.git(/|$)")]
TRAILER_CLAUDE = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

# formatos de segredo (o valor nunca é impresso)
FORMATOS = [
    ("chave da Anthropic", re.compile(r"sk-ant-[A-Za-z0-9_-]{20,}")),
    ("JWT (chave do Supabase ou token)", re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("token do GitHub", re.compile(r"\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})")),
    ("token do Telegram", re.compile(r"\b\d{8,10}:AA[A-Za-z0-9_-]{30,}")),
    ("chave secreta do Supabase", re.compile(r"\bsb_secret_[A-Za-z0-9_-]{10,}")),
    ("conexão com senha", re.compile(
        r"\b[a-z][a-z0-9+.-]*://[^\s:/@'\"]+:(?!(?:senha|password|pass|pwd|\*+|<[^>]*>|\[[^\]]*\]|\$\{[^}]*\}|\.\.\.|…)@)"
        r"[^\s@'\"]{4,}@")),
    ("chave privada", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    # KEY=valor no formato de ENV (nome em maiúsculas com PASS/SECRET/TOKEN/API_KEY e um valor de verdade depois)
    ("senha em configuração", re.compile(
        r"(?<![\w.])[A-Z][A-Z0-9_]*(?:PASS|PASSWORD|SECRET|TOKEN|API_KEY)[A-Z0-9_]*=(?![*<{$…]|x{3,}|\.\.\.|\s|$)"
        r"['\"]?[A-Za-z0-9+/=_@#!%&.:-]{8,}")),
    ("senha entre aspas", re.compile(
        r"(?i)\b(?:senha|password|passwd|pwd)\b\s*[:=]\s*['\"](?![*<{$…]|x{3,})[^'\"\s]{6,}['\"]")),
]
# testes do servidor têm segredo de mentira de propósito (mascaramento, servidores falsos): neles só vale o teste de
# valor real do ENV
SO_VALOR_REAL = ("servidor/teste/",)
TEXTO = {".md", ".txt", ".js", ".mjs", ".cjs", ".json", ".html", ".css", ".py", ".bat", ".ps1", ".sql", ".yml",
         ".yaml", ".toml", ".csv", ".svg", ".xml", ".example", ".gitignore", ".base", ""}
ZIP = {".xlsx", ".docx", ".pptx"}


def git(*args, ok=(0,)):
    r = subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode not in ok:
        raise SystemExit(f"PAROU: git {' '.join(args[:2])} falhou: {(r.stderr or r.stdout).strip()[:400]}")
    return r


def fora_por_lista():
    arq = RAIZ / "ferramentas" / "fora_do_repositorio.txt"
    if not arq.is_file():
        return set()
    return {l.strip() for l in arq.read_text(encoding="utf-8").splitlines() if l.strip() and not l.lstrip().startswith("#")}


def marcada_fora(p: Path):
    """Nota com 'repositorio: nao' no frontmatter fica fora do GitHub."""
    if p.suffix.lower() != ".md":
        return False
    cab = p.read_text(encoding="utf-8", errors="replace")[:3000]
    m = re.match(r"\A---\r?\n(.*?)\r?\n---", cab, re.S)
    return bool(m and re.search(r"(?mi)^reposit[oó]rio:\s*(n[aã]o|false|no)\s*$", m.group(1)))


def espelhar():
    if not VAULT.is_dir():
        raise SystemExit(f"PAROU: não achei o vault em {VAULT}")
    lista = fora_por_lista()
    fonte, fora = {}, []
    for p in VAULT.rglob("*"):
        if p.is_file():
            rel = p.relative_to(VAULT).as_posix()
            if any(f.search(rel) for f in FORA):
                continue
            if rel in lista or marcada_fora(p):
                fora.append(rel)
                continue
            fonte[rel] = p
    sumiu = sorted(lista - set(fora))
    if sumiu:
        print(f"Aviso: {len(sumiu)} nota(s) da lista de fora não existem mais no vault (renomeadas?): " + "; ".join(sumiu))
    DESTINO.mkdir(exist_ok=True)
    copiados = removidos = 0
    for rel, p in fonte.items():
        alvo = DESTINO / rel
        if alvo.exists() and alvo.stat().st_size == p.stat().st_size and alvo.read_bytes() == p.read_bytes():
            continue
        alvo.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, alvo)
        copiados += 1
    for p in sorted(DESTINO.rglob("*"), reverse=True):
        rel = p.relative_to(DESTINO).as_posix()
        if p.is_file() and rel not in fonte:
            p.unlink()
            removidos += 1
        elif p.is_dir() and not any(p.iterdir()):
            p.rmdir()
    return len(fonte), copiados, removidos, len(fora)


def valores_reais():
    """Senhas e chaves do ENV desta pasta (só para comparar; nunca saem daqui)."""
    vals = []
    arq = RAIZ / "ENV"
    if arq.is_file():
        for linha in arq.read_text(encoding="utf-8", errors="replace").splitlines():
            m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*)$", linha)
            if not m or not re.search(r"PASS|PASSWORD|KEY|TOKEN|SECRET", m.group(1)):
                continue
            v = m.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
                v = v[1:-1]
            if len(v) >= 8:
                vals.append((m.group(1), v))
    return vals


def textos_do_arquivo(p: Path):
    ext = p.suffix.lower()
    if ext in ZIP:
        try:
            with zipfile.ZipFile(p) as z:
                for nome in z.namelist():
                    if nome.endswith((".xml", ".rels")):
                        yield z.read(nome).decode("utf-8", errors="replace")
        except zipfile.BadZipFile:
            return
    elif ext in TEXTO or p.name in ("ENV.example", "INICIAR.bat", ".gitignore"):
        yield p.read_text(encoding="utf-8", errors="replace")


def conferir_segredos():
    arquivos = git("ls-files", "-co", "--exclude-standard", "-z").stdout.split("\0")
    reais = valores_reais()
    problemas = []
    for rel in filter(None, arquivos):
        if rel == "ENV" or rel.endswith("/ENV"):
            problemas.append((rel, 0, "o próprio ENV está fora do .gitignore"))
            continue
        p = RAIZ / rel
        if not p.is_file():
            continue
        for texto in textos_do_arquivo(p):
            for nome, v in reais:
                if v in texto:
                    n = texto[: texto.index(v)].count("\n") + 1
                    problemas.append((rel, n, f"valor real de {nome} do ENV"))
            if rel.startswith(SO_VALOR_REAL):
                continue
            for i, linha in enumerate(texto.splitlines(), 1):
                for tipo, rx in FORMATOS:
                    if rx.search(linha):
                        problemas.append((rel, i, tipo))
    return len([a for a in arquivos if a]), len(reais), problemas


def visibilidade():
    url = git("remote", "get-url", "origin", ok=(0, 2)).stdout.strip()
    m = re.search(r"github\.com[/:]([^/]+)/([^/.]+?)(?:\.git)?$", url)
    if not m:
        return url, "desconhecida"
    req = urllib.request.Request(f"https://api.github.com/repos/{m.group(1)}/{m.group(2)}",
                                 headers={"User-Agent": "cerebro-lube", "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return url, "pública" if not json.load(r).get("private") else "privada"
    except urllib.error.HTTPError as e:
        return url, "privada" if e.code == 404 else "desconhecida"   # sem login, repositório privado responde 404
    except OSError:
        return url, "desconhecida"


def main():
    autor_claude = "--autor" in sys.argv and sys.argv[sys.argv.index("--autor") + 1:][:1] == ["claude"]
    sem_push = "--sem-push" in sys.argv

    total, copiados, removidos, fora = espelhar()
    print(f"Vault: {total} arquivos ({copiados} copiados, {removidos} removidos da cópia); "
          f"{fora} nota(s) com dado de pessoa ficaram só no OneDrive.")

    ignorados = [l for l in git("ls-files", "--others", "--ignored", "--exclude-standard", "--", "vault").stdout.splitlines() if l]
    if ignorados:
        print(f"PAROU: {len(ignorados)} arquivo(s) do vault estão sendo ignorados pelo .gitignore e ficariam sem backup, "
              f"ex.: {ignorados[0]}. Ajuste o .gitignore (no Windows o Git não diferencia maiúscula).")
        sys.exit(4)

    n, n_reais, problemas = conferir_segredos()
    if problemas:
        print(f"PAROU: possível segredo em {len(problemas)} ponto(s) (nada foi commitado nem enviado):")
        for rel, linha, tipo in problemas[:40]:
            print(f"  {rel}:{linha} — {tipo}")
        print("Tire o segredo do arquivo (no vault, a nota original) e rode de novo.")
        sys.exit(2)
    print(f"Segredos: nada achado em {n} arquivos (formatos de chave e senha, e {n_reais} valores reais do ENV).")

    # só a cópia do vault entra neste commit: código em andamento no repositório (de outra conversa ou de um agente)
    # não pode ir junto com o nome "atualização" (aconteceu em 2026-10-19). O commit com caminho registra só vault/,
    # mesmo que haja outra coisa preparada no índice.
    git("add", "-A", "--", "vault")
    if git("diff", "--cached", "--quiet", "--", "vault", ok=(0, 1)).returncode == 0:
        print("Nada novo no vault para registrar.")
    else:
        mudou = git("diff", "--cached", "--name-only", "--", "vault").stdout.split("\n")
        msg = f"Cérebro: atualização de {datetime.now():%Y-%m-%d %H:%M} ({len([m for m in mudou if m])} arquivos)"
        if autor_claude:
            msg += "\n\n" + TRAILER_CLAUDE
        git("commit", "-q", "-m", msg, "--", "vault")
        print("Commit:", git("log", "-1", "--format=%h %s").stdout.strip())
    fora_do_vault = [l for l in git("status", "--porcelain").stdout.splitlines() if l and not l[3:].strip('"').startswith("vault/")]
    if fora_do_vault:
        print(f"Aviso: {len(fora_do_vault)} mudança(s) fora do vault ficaram sem commit (código em andamento); "
              "o push leva só o que já tem commit.")

    if sem_push:
        print("Sem push (--sem-push).")
        return
    url, vis = visibilidade()
    if vis != "privada":
        print(f"NÃO ENVIADO: o repositório {url} está com visibilidade {vis}. O vault só sobe para repositório privado.")
        print("No GitHub: Settings > General > Danger Zone > Change visibility > Private. Depois rode de novo.")
        sys.exit(3)
    adiante = git("rev-list", "--count", "origin/main..main", ok=(0, 128)).stdout.strip()
    git("push", "-u", "origin", "main")
    print(f"Enviado para {url} (repositório privado){f', {adiante} commit(s)' if adiante.isdigit() else ''}.")


if __name__ == "__main__":
    main()
