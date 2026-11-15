"""Diagnostic de chaque valeur : indicateurs chiffrés et signaux factuels.

Les signaux décrivent ce qui s'est passé (forte baisse, volume inhabituel, plus bas
annuel...). Ce ne sont PAS des recommandations d'achat ou de vente.
"""
from __future__ import annotations

import math

import pandas as pd

from .strategies import analyser
from . import objectif

# Seuils des signaux (modifiables)
SEUIL_FORTE_VARIATION = 4.0      # % sur la séance
SEUIL_VOLUME_INHABITUEL = 2.5    # volume du jour / volume moyen 3 mois
SEUIL_PROCHE_EXTREME = 5.0       # % d'écart avec le plus haut / plus bas 52 semaines
RSI_BAS, RSI_HAUT = 30, 70


def _pct(a, b):
    return None if a is None or b is None or b == 0 or pd.isna(a) or pd.isna(b) else (a / b - 1) * 100


def _cours_il_y_a(c: pd.Series, jours: int):
    passe = c[c.index <= c.index[-1] - pd.Timedelta(days=jours)]
    return None if passe.empty else passe.iloc[-1]


def rsi(c: pd.Series, n: int = 14):
    """RSI de Wilder sur n séances."""
    if len(c) <= n:
        return None
    d = c.diff().dropna()
    hausse = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean().iloc[-1]
    baisse = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean().iloc[-1]
    if baisse == 0:
        return 100.0
    return 100 - 100 / (1 + hausse / baisse)


def diagnostiquer(nom: str, isin: str, df: pd.DataFrame, derniere_seance_marche, evenements=()) -> dict:
    c = df["Cloture"]
    v = df["Volume"].fillna(0)
    dernier = c.iloc[-1]
    precedent = c.iloc[-2] if len(c) > 1 else None
    an = c[c.index > c.index[-1] - pd.Timedelta(days=365)]
    haut52, bas52 = an.max(), an.min()
    debut_annee = c[c.index < pd.Timestamp(c.index[-1].year, 1, 1)]
    vol_moy = v.iloc[-64:-1].mean() if len(v) > 5 else None
    mm50 = c.tail(50).mean() if len(c) >= 50 else None
    mm200 = c.tail(200).mean() if len(c) >= 200 else None
    mm200_veille = c.iloc[-201:-1].mean() if len(c) >= 201 else None
    rend = c.pct_change().dropna().tail(250)

    d = {
        "nom": nom, "isin": isin,
        "date": c.index[-1].strftime("%Y-%m-%d"),
        "cours": round(float(dernier), 2),
        "var_jour": _pct(dernier, precedent),
        "var_5j": _pct(dernier, _cours_il_y_a(c, 7)),
        "var_1m": _pct(dernier, _cours_il_y_a(c, 30)),
        "var_ytd": _pct(dernier, debut_annee.iloc[-1]) if not debut_annee.empty else None,
        "var_1a": _pct(dernier, _cours_il_y_a(c, 365)),
        "haut_52s": float(haut52), "bas_52s": float(bas52),
        "ecart_haut_52s": _pct(dernier, haut52), "ecart_bas_52s": _pct(dernier, bas52),
        "volume": float(v.iloc[-1]),
        "volume_moy_3m": None if vol_moy is None or pd.isna(vol_moy) else float(vol_moy),
        "ratio_volume": (float(v.iloc[-1] / vol_moy) if vol_moy else None),
        "rsi14": rsi(c),
        "mm50": mm50, "mm200": mm200,
        "ecart_mm200": _pct(dernier, mm200),
        "volatilite": float(rend.std() * math.sqrt(250) * 100) if len(rend) > 20 else None,
        "historique": [round(float(x), 2) for x in c.tail(250)],
    }

    # --- Signaux factuels -------------------------------------------------
    s = []
    a_jour = derniere_seance_marche is None or c.index[-1] >= derniere_seance_marche
    jour = c.index[-1].strftime("%Y-%m-%d")
    for e in evenements:
        if e["date"] == jour:
            s.append((f"Détachement de dividende (-{e['impact_pct']:.1f} %), cours corrigé".replace(".", ","), "info", 0, "dividende", e["impact_pct"]))
    if not a_jour:
        # Pas coté à la dernière séance : sa variation date d'une séance antérieure,
        # on ne l'affiche pas comme variation du jour.
        d["var_jour"] = None
        d["ratio_volume"] = None
        s.append(("Pas d'échange à la dernière séance", "neutre", 0, "non_echange", None))
    else:
        vj = d["var_jour"]
        if vj is not None and vj <= -SEUIL_FORTE_VARIATION:
            s.append((f"Forte baisse ({vj:+.1f} %)".replace(".", ","), "baisse", 3, "forte_baisse", vj))
        if vj is not None and vj >= SEUIL_FORTE_VARIATION:
            s.append((f"Forte hausse ({vj:+.1f} %)".replace(".", ","), "hausse", 3, "forte_hausse", vj))
        if d["ratio_volume"] and d["ratio_volume"] >= SEUIL_VOLUME_INHABITUEL:
            s.append((f"Volume ×{d['ratio_volume']:.1f} la moyenne".replace(".", ","), "info", 2, "volume", d["ratio_volume"]))
    if len(an) > 120:
        if dernier <= bas52:
            s.append(("Plus bas sur 52 semaines", "baisse", 3, "plus_bas_52", None))
        elif d["ecart_bas_52s"] is not None and d["ecart_bas_52s"] <= SEUIL_PROCHE_EXTREME:
            s.append(("Proche du plus bas 52 sem.", "baisse", 1, "proche_bas_52", None))
        if dernier >= haut52:
            s.append(("Plus haut sur 52 semaines", "hausse", 3, "plus_haut_52", None))
        elif d["ecart_haut_52s"] is not None and d["ecart_haut_52s"] >= -SEUIL_PROCHE_EXTREME:
            s.append(("Proche du plus haut 52 sem.", "hausse", 1, "proche_haut_52", None))
    if d["rsi14"] is not None:
        if d["rsi14"] < RSI_BAS:
            s.append((f"RSI bas ({d['rsi14']:.0f})", "baisse", 1, "rsi_bas", d["rsi14"]))
        elif d["rsi14"] > RSI_HAUT:
            s.append((f"RSI élevé ({d['rsi14']:.0f})", "hausse", 1, "rsi_haut", d["rsi14"]))
    if mm200 and mm200_veille and precedent:
        if precedent >= mm200_veille and dernier < mm200:
            s.append(("Passe sous la MM200", "baisse", 2, "sous_mm200", None))
        elif precedent <= mm200_veille and dernier > mm200:
            s.append(("Repasse au-dessus de la MM200", "hausse", 2, "sur_mm200", None))

    d["signaux"] = [{"texte": t, "type": ty, "code": co, "v": None if v is None else round(float(v), 2)}
                    for t, ty, _, co, v in s]
    d["attention"] = sum(x[2] for x in s)   # intensité des signaux, pas une note d'achat
    d["a_jour"] = a_jour
    d["premiere_seance"] = c.index[0].strftime("%Y-%m-%d")
    limite = (c.index[-1] - pd.Timedelta(days=730)).strftime("%Y-%m-%d")
    d["evenements"] = [e for e in evenements if e["date"] >= limite]
    d["nb_seances"] = len(c)
    d.update(analyser(df, a_jour))           # règles testées, suggestions, amplitude, liquidité
    d["strategie"] = objectif.analyser(df) if a_jour else {}   # « Ma stratégie » : objectif +X %
    return {k: (round(x, 2) if isinstance(x, float) and not math.isnan(x) else
                (None if isinstance(x, float) else x)) for k, x in d.items()}


def diagnostiquer_tout(series, masi: pd.Series) -> dict:
    ok = [s for s in series if not s.donnees.empty and len(s.donnees) >= 2]
    derniere = max((s.donnees.index[-1] for s in ok), default=None)
    fiches = [diagnostiquer(s.nom, s.isin, s.donnees, derniere, s.evenements) for s in ok]

    actives = [f for f in fiches if f["a_jour"] and f["var_jour"] is not None]
    marche = {
        "date_seance": derniere.strftime("%Y-%m-%d") if derniere is not None else None,
        "nb_valeurs": len(series), "nb_diagnostiquees": len(fiches),
        "nb_hausse": sum(f["var_jour"] > 0 for f in actives),
        "nb_baisse": sum(f["var_jour"] < 0 for f in actives),
        "nb_stable": sum(f["var_jour"] == 0 for f in actives),
        "masi": None, "masi_var": None, "masi_historique": [],
    }
    if len(masi) >= 2:
        marche.update(masi=round(float(masi.iloc[-1]), 2),
                      masi_var=round((masi.iloc[-1] / masi.iloc[-2] - 1) * 100, 2),
                      masi_ytd=_pct(masi.iloc[-1], masi[masi.index < pd.Timestamp(masi.index[-1].year, 1, 1)].iloc[-1])
                      if (masi.index < pd.Timestamp(masi.index[-1].year, 1, 1)).any() else None,
                      masi_historique=[round(float(x), 2) for x in masi.tail(250)])
    echecs = [{"nom": s.nom, "isin": s.isin, "erreur": s.erreur or "historique insuffisant"}
              for s in series if s not in ok]
    return {"marche": marche, "valeurs": fiches, "echecs": echecs}
