"""Génération des sorties : page web (téléphone + PC) et classeur Excel."""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

GABARIT = Path(__file__).with_name("gabarit.html")
STATIQUE = Path(__file__).with_name("static")


def _json_defaut(o):
    """Convertit les types numpy/pandas (int64, float64, bool_) en types Python."""
    if hasattr(o, "item"):
        return o.item()
    raise TypeError(f"type non sérialisable : {type(o).__name__}")


def serie_json(df: pd.DataFrame) -> dict:
    """Historique compact : dates, clôtures, plus hauts, plus bas, volumes."""
    arr = lambda col: [None if pd.isna(x) else round(float(x), 2) for x in df[col]]
    return {"d": [x.strftime("%Y-%m-%d") for x in df.index], "c": arr("Cloture"),
            "h": arr("Haut"), "b": arr("Bas"), "v": [None if pd.isna(x) else int(x) for x in df["Volume"]]}


def ecrire_historiques(series, dossier: Path) -> None:
    """Un fichier par valeur avec tout l'historique (pour les graphiques longs de l'application)."""
    h = dossier / "historique"
    h.mkdir(parents=True, exist_ok=True)
    for s in series:
        if s.donnees.empty:
            continue
        df = s.donnees
        (h / f"{s.isin}.json").write_text(json.dumps(serie_json(df), separators=(",", ":")), encoding="utf-8")


def ecrire_page(diag: dict, dossier: Path, demo: bool = False) -> Path:
    dossier.mkdir(parents=True, exist_ok=True)
    diag = dict(diag, genere_le=datetime.now(timezone.utc).isoformat(timespec="minutes"), demo=demo)
    html = GABARIT.read_text(encoding="utf-8").replace(
        "__TEXTES__", Path(__file__).with_name("i18n.js").read_text(encoding="utf-8")).replace(
        "__DONNEES__", json.dumps(diag, ensure_ascii=False, separators=(",", ":"), default=_json_defaut))
    (dossier / "index.html").write_text(html, encoding="utf-8")
    (dossier / "donnees.json").write_text(json.dumps(diag, ensure_ascii=False, default=_json_defaut), encoding="utf-8")
    (dossier / "manifest.webmanifest").write_text(json.dumps({
        "name": "BVC Matin", "short_name": "BVC Matin", "lang": "fr", "start_url": "./",
        "scope": "./", "display": "standalone", "orientation": "portrait",
        "background_color": "#0f1720", "theme_color": "#0f1720",
        "icons": [{"src": "icone-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "icone-512.png", "sizes": "512x512", "type": "image/png"},
                  {"src": "icone-maskable-512.png", "sizes": "512x512", "type": "image/png",
                   "purpose": "maskable"}]}, ensure_ascii=False), encoding="utf-8")
    for f in STATIQUE.iterdir():                       # icônes PNG + service worker
        shutil.copy(f, dossier / f.name)
    return dossier / "index.html"


COLONNES_EXCEL = {
    "nom": "Valeur", "isin": "Symbole", "date": "Dernière séance", "cours": "Cours (MAD)",
    "var_jour": "Var. jour %", "var_5j": "Var. 5 j %", "var_1m": "Var. 1 mois %",
    "var_ytd": "Var. depuis 1er janv. %", "var_1a": "Var. 1 an %",
    "haut_52s": "Plus haut 52 sem.", "bas_52s": "Plus bas 52 sem.",
    "ecart_haut_52s": "Écart plus haut %", "ecart_bas_52s": "Écart plus bas %",
    "volume": "Volume", "volume_moy_3m": "Volume moyen 3 mois", "ratio_volume": "Volume / moyenne",
    "rsi14": "RSI 14", "mm50": "MM50", "mm200": "MM200", "ecart_mm200": "Écart MM200 %",
    "volatilite": "Volatilité annuelle %", "attention": "Intensité des signaux", "signaux": "Signaux", "suggestions": "Règles déclenchées",
    "amplitude_moy": "Amplitude moyenne séance %", "capitaux_moy": "Capitaux moyens/jour (MAD, estim.)",
}


def ecrire_excel(diag: dict, chemin: Path) -> Path:
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    df = pd.DataFrame(diag["valeurs"])
    if not df.empty:
        df["signaux"] = df["signaux"].apply(lambda l: " ; ".join(s["texte"] for s in l))
        signe = lambda x: "—" if x is None else f"{x:+}"
        df["suggestions"] = df["suggestions"].apply(lambda l: " ; ".join(
            f"{s['sens'].upper()} - {s['nom']} ({s['operations']} op., {s.get('taux_reussite') if s.get('taux_reussite') is not None else '—'} % réussite, "
            f"{signe(s.get('gain_moyen'))} % moyen{', validée' if s['fiable'] else ', non validée'})" for s in (l or [])))
        df = df[list(COLONNES_EXCEL)].rename(columns=COLONNES_EXCEL).sort_values("Var. jour %")
    m = diag["marche"]
    resume = pd.DataFrame([
        ("Séance", m["date_seance"]), ("Capitalisation du marché (Mds MAD)", m["masi"]), ("Capitalisation var. jour %", m["masi_var"]),
        ("Valeurs en hausse", m["nb_hausse"]), ("Valeurs en baisse", m["nb_baisse"]),
        ("Valeurs stables", m["nb_stable"]),
        ("Valeurs diagnostiquées", f"{m['nb_diagnostiquees']} / {m['nb_valeurs']}"),
    ], columns=["Indicateur", "Valeur"])

    with pd.ExcelWriter(chemin, engine="openpyxl") as w:
        for nom, t in (("Marché", resume), ("Diagnostic", df),
                       ("Échecs", pd.DataFrame(diag["echecs"]))):
            (t if not t.empty else pd.DataFrame({"Info": ["Aucun"]})).to_excel(w, sheet_name=nom, index=False)
            ws = w.sheets[nom]
            for cell in ws[1]:
                cell.font = Font(bold=True, color="FFFFFF")
                cell.fill = PatternFill("solid", fgColor="1F3A5F")
            ws.freeze_panes = "B2"
            for i, col in enumerate(ws.columns, 1):
                larg = max(len(str(c.value or "")) for c in list(col)[:100])
                ws.column_dimensions[get_column_letter(i)].width = min(max(larg + 2, 10), 60)
    return chemin
