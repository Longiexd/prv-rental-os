"""Replaceable basic rental contract template; no accounting or booking mutations."""
from html import escape


def render_contract(fields: dict) -> str:
    def cell(value):
        return escape(str(value)) if value is not None and value is not False and value != "" else "—"

    rows = "".join(f"<tr><th>{cell(label)}</th><td>{cell(value)}</td></tr>" for label, value in fields.items())
    return f'''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer"><title>Contrat de location</title>
<style>body{{font:14px Arial,sans-serif;color:#111;background:#fff;max-width:800px;margin:32px auto;padding:20px}}
h1{{font-size:24px}}table{{width:100%;border-collapse:collapse}}th,td{{border:1px solid #999;padding:9px;text-align:left;overflow-wrap:anywhere}}
th{{width:35%}}.signatures{{display:flex;justify-content:space-between;margin-top:60px}}
@media print{{body{{margin:0;padding:0}}.print-help{{display:none}}tr{{break-inside:avoid}}}}</style></head>
<body><p class="print-help">Utilisez Ctrl+P / Imprimer pour imprimer ou enregistrer en PDF.</p>
<h1>Contrat de location de véhicule</h1><p>Modèle de base · Conditions particulières à compléter par l’agence.</p>
<table>{rows}</table><p>Observations et conditions convenues : __________________________________________</p>
<div class="signatures"><span>Signature de l’agence<br><br>___________________</span>
<span>Signature du client<br><br>___________________</span></div></body></html>'''
