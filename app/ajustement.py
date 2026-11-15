"""Correction des dividendes et opérations sur titres dans l'historique.

Le jour du détachement d'un dividende, le cours baisse mécaniquement du montant du
dividende. Sans correction, l'application y verrait une « forte baisse » et les règles
de rebond seraient faussées. On corrige donc tout l'historique antérieur (méthode
classique de l'ajustement : les cours d'avant sont multipliés par un facteur < 1).

Deux sources d'événements :
  1. Détection automatique : la Bourse calcule la variation officielle d'une séance par
     rapport à un cours de référence déjà ajusté du dividende. Quand la variation publiée
     s'écarte nettement de la variation brute (clôture / clôture de la veille), c'est le
     signe d'un détachement ou d'une autre opération sur titre.
  2. Le fichier operations_titres.csv (isin, date, dividende) pour saisir ou corriger
     un dividende à la main ; il est prioritaire sur la détection.
"""
from __future__ import annotations

import csv
from pathlib import Path

import pandas as pd

ECART_MIN = 0.008          # écart minimal (0,8 point) entre variation officielle et brute
ECART_MAX = 0.60           # au-delà, on considère une donnée aberrante plutôt qu'un dividende


def lire_operations_manuelles(chemin: Path) -> dict[str, list[tuple[pd.Timestamp, float]]]:
    """isin -> [(date de détachement, dividende par action en MAD)]."""
    res: dict[str, list] = {}
    if not chemin.exists():
        return res
    with open(chemin, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            try:
                res.setdefault(r["isin"].strip(), []).append(
                    (pd.Timestamp(r["date"].strip()), float(r["dividende"].replace(",", "."))))
            except (KeyError, ValueError):
                continue
    return res


def detecter(df: pd.DataFrame) -> list[dict]:
    """Repère les séances où la variation publiée ne correspond pas à la variation brute."""
    if "Variation" not in df or df["Variation"].isna().all():
        return []
    brute = df["Cloture"].pct_change()
    officielle = df["Variation"] / 100.0
    evts = []
    for date, b, o in zip(df.index[1:], brute.iloc[1:], officielle.iloc[1:]):
        if pd.isna(b) or pd.isna(o):
            continue
        ecart = o - b                     # > 0 : le cours a « perdu » plus que la variation officielle
        if ECART_MIN <= ecart <= ECART_MAX:
            facteur = (1 + b) / (1 + o)   # < 1
            evts.append({"date": date, "facteur": float(facteur), "source": "détecté"})
    return evts


def ajuster(df: pd.DataFrame, isin: str, manuels: dict) -> tuple[pd.DataFrame, list[dict]]:
    """Renvoie l'historique ajusté et la liste des événements appliqués."""
    if df.empty:
        return df, []
    evts = {e["date"]: e for e in detecter(df)}
    for date, dividende in manuels.get(isin, []):
        avant = df["Cloture"][df.index < date]
        if avant.empty or date not in df.index:
            continue
        evts[date] = {"date": date, "facteur": float(1 - dividende / avant.iloc[-1]),
                      "source": "manuel", "dividende": dividende}
    if not evts:
        return df, []

    adj = df.copy()
    facteur = pd.Series(1.0, index=df.index)
    for e in evts.values():
        facteur[df.index < e["date"]] *= e["facteur"]
    for col in ("Cloture", "Haut", "Bas"):
        adj[col] = df[col] * facteur
    liste = sorted(({**e, "date": e["date"].strftime("%Y-%m-%d"),
                     "impact_pct": round((1 - e["facteur"]) * 100, 2)} for e in evts.values()),
                   key=lambda e: e["date"])
    return adj, liste


def ajuster_tout(series, racine: Path) -> None:
    """Ajuste chaque série en place et lui attache ses événements."""
    manuels = lire_operations_manuelles(racine / "operations_titres.csv")
    for s in series:
        s.donnees, s.evenements = ajuster(s.donnees, s.isin, manuels)
