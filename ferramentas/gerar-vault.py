"""Gera cerebro-robo/api/vault (JSON {vaultName, files}) a partir do vault real, SÓ para teste local do painel."""
import json, os

V = r'C:\Users\gti.julio.alves\OneDrive - Lube\CEREBRO DA LUBE'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cerebro-robo', 'api', 'vault')
files = []
for d, subs, fs in os.walk(V):
    subs[:] = [s for s in subs if not s.startswith('.')]
    for f in fs:
        if f.lower().endswith('.md'):
            p = os.path.join(d, f)
            st = os.stat(p)
            files.append({'path': os.path.relpath(p, V).replace(os.sep, '/'),
                          'text': open(p, encoding='utf-8', errors='replace').read(),
                          'size': st.st_size, 'mtime': int(st.st_mtime * 1000)})
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({'vaultName': 'CEREBRO DA LUBE', 'files': files}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(files), 'notas em', OUT)
