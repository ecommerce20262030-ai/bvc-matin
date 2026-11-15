"""Bilan des suggestions : ce qu'elles sont devenues en vrai.

Deux bilans :
  - BILAN RÉEL : chaque suggestion validée est inscrite dans data/suivi_suggestions.csv
    le jour où elle apparaît (le fichier est conservé dans le dépôt GitHub d'un jour à
    l'autre), puis suivie jusqu'à sa sortie (durée prévue atteinte ou seuil de sortie touché).
  - BILAN RECONSTITUÉ : on rejoue les dernières séances comme si l'application avait tourné
    chaque jour, en ne validant les règles qu'avec les données connues à ce moment-là
    (revalidation toutes les 20 séances). Il donne un premier avis dès le premier jour,
    sans attendre que le bilan réel se remplisse.

Hypothèses identiques au moteur : achat à la clôture du lendemain du signal, revente à la
clôture N séances plus tard, ou plus tôt si la clôture passe sous le seuil de sortie.
"""
from __future__ import annotations

import csv
from pathlib import Path

import numpy as np
import pandas as pd

from .strategies import (FRAIS_ACHAT, FRAIS_VENTE, REGLES, atr, indicateurs, profil_court_terme,
                         tester, verdict, MIN_CAPITAUX_JOUR, MIN_JOURS_ACTIFS)

CHAMPS = ["date_signal", "isin", "nom", "regle", "nom_regle", "sens", "duree", "stop_pct",
          "statut", "date_entree", "prix_entree", "date_sortie", "prix_sortie", "sortie", "resultat_pct"]
REGLES_PAR_CODE = {r.code: r for r in REGLES}


def suivre_operation(df: pd.DataFrame, i_signal: int, sens: str, duree: int, stop_pct: float) -> dict:
    """Résultat d'une suggestion émise à la séance i_signal (stop_pct négatif, en %)."""
    c, dates, n = df["Cloture"].to_numpy(), df.index, len(df)
    if i_signal + 1 >= n:
        return {"statut": "attente"}
    entree = c[i_signal + 1]
    fin = i_signal + 1 + duree
    sortie_i, motif = None, None
    for j in range(i_signal + 2, min(fin, n - 1) + 1):
        if sens == "achat" and c[j] <= entree * (1 + stop_pct / 100):
            sortie_i, motif = j, "seuil de sortie"
            break
        if j == fin:
            sortie_i, motif = j, "durée atteinte"
    j = sortie_i if sortie_i is not None else n - 1
    if sens == "achat":
        res = c[j] * (1 - FRAIS_VENTE) / (entree * (1 + FRAIS_ACHAT)) - 1
    else:
        res = c[j] / entree - 1
    return {
        "statut": "clos" if sortie_i is not None else "en_cours",
        "date_entree": dates[i_signal + 1].strftime("%Y-%m-%d"), "prix_entree": round(float(entree), 2),
        "date_sortie": dates[j].strftime("%Y-%m-%d") if sortie_i is not None else "",
        "prix_sortie": round(float(c[j]), 2), "sortie": motif or "",
        "resultat_pct": round(float(res) * 100, 2),
    }


def _stop_pct(df_jusqua: pd.DataFrame) -> float:
    cours = float(df_jusqua["Cloture"].iloc[-1])
    return -min(max(2 * atr(df_jusqua) / cours, 0.03), 0.12) * 100


# ---------------------------------------------------------------- bilan réel
def lire_journal(chemin: Path) -> list[dict]:
    if not chemin.exists():
        return []
    with open(chemin, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def mettre_a_jour_journal(chemin: Path, series, fiches: list[dict]) -> list[dict]:
    journal = lire_journal(chemin)
    deja = {(l["date_signal"], l["isin"], l["regle"]) for l in journal}
    for f in fiches:
        for s in f.get("suggestions", []):
            cle = (f["date"], f["isin"], s["code"])
            if s["fiable"] and cle not in deja:
                stop = s.get("plan", {}).get("stop_pct", 0.0) if s["sens"] == "achat" else 0.0
                journal.append({"date_signal": f["date"], "isin": f["isin"], "nom": f["nom"], "regle": s["code"],
                                "nom_regle": s["nom"], "sens": s["sens"], "duree": s["duree"],
                                "stop_pct": stop, "statut": "attente"})
                deja.add(cle)
    par_isin = {s.isin: s.donnees for s in series if not s.donnees.empty}
    for l in journal:
        if l.get("statut") == "clos" or l["isin"] not in par_isin:
            continue
        df = par_isin[l["isin"]]
        pos = df.index.get_indexer([pd.Timestamp(l["date_signal"])])[0]
        if pos < 0:
            continue
        l.update(suivre_operation(df, pos, l["sens"], int(l["duree"]), float(l["stop_pct"] or 0)))
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with open(chemin, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CHAMPS, extrasaction="ignore")
        w.writeheader()
        w.writerows(journal)
    return journal


# ---------------------------------------------------------- bilan reconstitué
def reconstituer(series, nb_seances: int = 120, pas: int = 20) -> list[dict]:
    lignes = []
    for s in series:
        df = s.donnees
        n = len(df)
        if n < 400:
            continue
        x = indicateurs(df)          # indicateurs causaux : chaque valeur n'utilise que le passé
        for debut in range(n - nb_seances, n, pas):
            hist = x.iloc[:debut]
            prof = profil_court_terme(df.iloc[:debut])
            liquide = (prof["capitaux_moy"] or 0) >= MIN_CAPITAUX_JOUR and \
                      (prof["jours_actifs_pct"] or 0) >= MIN_JOURS_ACTIFS * 100
            for r in REGLES:
                ok, _, _ = verdict(r, tester(r, hist), liquide)
                if not ok:
                    continue
                cond = r.condition(x).fillna(False).to_numpy()
                i = debut
                while i < min(debut + pas, n):
                    if cond[i]:
                        stop = _stop_pct(df.iloc[:i + 1]) if r.sens == "achat" else 0.0
                        op = suivre_operation(df, i, r.sens, r.duree, stop)
                        if op["statut"] != "attente":
                            lignes.append({"date_signal": df.index[i].strftime("%Y-%m-%d"), "isin": s.isin,
                                           "nom": s.nom, "regle": r.code, "nom_regle": r.nom,
                                           "sens": r.sens, "duree": r.duree, "stop_pct": round(stop, 2), **op})
                        i += 1 + r.duree
                    else:
                        i += 1
    return sorted(lignes, key=lambda l: l["date_signal"])


# ------------------------------------------------------------------ synthèse
def synthese(lignes: list[dict]) -> dict:
    def stats(ls):
        r = np.array([float(l["resultat_pct"]) for l in ls if l.get("resultat_pct") not in (None, "")])
        if not len(r):
            return {"nombre": 0}
        return {"nombre": int(len(r)), "gagnantes_pct": round(float((r > 0).mean()) * 100, 1),
                "moyenne_pct": round(float(r.mean()), 2), "somme_pct": round(float(r.sum()), 2),
                "pire_pct": round(float(r.min()), 2), "meilleure_pct": round(float(r.max()), 2)}
    achats = [l for l in lignes if l["sens"] == "achat"]
    closes = [l for l in achats if l.get("statut") == "clos"]
    par_regle = {}
    for l in closes:
        par_regle.setdefault(l["regle"], []).append(l)
    return {
        "achats_clos": stats(closes),
        "en_cours": len([l for l in achats if l.get("statut") in ("en_cours", "attente")]),
        "par_regle": {k: stats(v) for k, v in par_regle.items()},
        "debut": lignes[0]["date_signal"] if lignes else None,
        "dernieres": [{k: l.get(k) for k in ("date_signal", "isin", "nom", "regle", "nom_regle", "sens", "statut",
                                             "prix_entree", "prix_sortie", "sortie", "resultat_pct")}
                      for l in sorted(achats, key=lambda l: l["date_signal"], reverse=True)[:40]],
    }
