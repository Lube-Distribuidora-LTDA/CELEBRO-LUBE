"""Junta o painel do Cérebro (index.html + css + todos os módulos de js/) num único .html que abre com dois cliques.

Cada módulo vira um blob: URL criado na hora, com os imports relativos ('./nome.js', estáticos ou dinâmicos)
trocados pelas URLs novas, na ordem das dependências. O que vem de CDN (three, MediaPipe) continua vindo da internet.
Uso: python -I empacotar.py <pasta_do_projeto> <saida.html>
"""
import json, re, sys
from pathlib import Path

proj, saida = Path(sys.argv[1]), Path(sys.argv[2])
html = (proj / 'index.html').read_text(encoding='utf-8')
css = (proj / 'css' / 'estilo.css').read_text(encoding='utf-8')
mods = {p.stem: p.read_text(encoding='utf-8') for p in sorted((proj / 'js').glob('*.js'))}
RX = re.compile(r"""(['"])\./([A-Za-z0-9_-]+)\.js\1""")

deps = {n: {m.group(2) for m in RX.finditer(s)} for n, s in mods.items()}
for n, ds in deps.items():
    faltam = ds - mods.keys()
    if faltam:
        raise SystemExit(f'{n}.js importa módulo que não existe: {faltam}')
ordem, feitos = [], set()
while len(ordem) < len(mods):
    prontos = [n for n in mods if n not in feitos and deps[n] <= feitos]
    if not prontos:
        raise SystemExit(f'importação circular entre: {set(mods) - feitos}')
    for n in prontos:
        ordem.append(n); feitos.add(n)

def troca_obrigatoria(texto, antes, depois):
    if antes not in texto:
        raise SystemExit(f'não achei no index.html: {antes}')
    return texto.replace(antes, depois)

html = troca_obrigatoria(html, '<link rel="stylesheet" href="css/estilo.css">', '<style>\n' + css.replace('</style', '<\\/style') + '\n</style>')
html = re.sub(r'<link rel="modulepreload" href="js/[A-Za-z0-9_-]+\.js">\s*', '', html)

lit = lambda s: json.dumps(s, ensure_ascii=False).replace('<', '\\u003c')
carregador = (
    '<script>\n(function () {\n'
    '  var fonte = {' + ', '.join(f'{lit(n)}: {lit(mods[n])}' for n in ordem) + '};\n'
    '  var ordem = ' + json.dumps(ordem) + ';\n'
    '  var url = {};\n'
    '  function liga(src) { return src.replace(/([\'"])\\.\\/([A-Za-z0-9_-]+)\\.js\\1/g, function (m, q, n) { return url[n] ? q + url[n] + q : m; }); }\n'
    '  ordem.forEach(function (n) { url[n] = URL.createObjectURL(new Blob([liga(fonte[n])], { type: "text/javascript" })); });\n'
    '  var s = document.createElement("script"); s.type = "module"; s.src = url.app; document.body.appendChild(s);\n'
    '})();\n</script>'
)
html = troca_obrigatoria(html, '<script type="module" src="js/app.js"></script>', carregador)

pagina = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
          '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
          '</head>\n<body>\n' + html + '\n</body>\n</html>\n')
saida.write_text(pagina, encoding='utf-8')
sobra = re.findall(r'(?:src|href)="(?:css|js)/[^"]+"', pagina)
print(f'{saida.name}: {len(pagina.encode()) / 1024:.0f} KB; ordem {ordem}; referências locais que sobraram: {sobra or "nenhuma"}')
