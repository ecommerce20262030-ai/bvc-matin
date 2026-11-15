"""Moteur de signaux : règles techniques testées sur tout l'historique de chaque valeur.

Principe : une règle ne devient une « suggestion » que si, sur cette valeur précise,
elle a historiquement rapporté de l'argent APRÈS FRAIS sur un nombre suffisant d'opérations.
Les statistiques sont affichées à côté de chaque suggestion. Rien ici n'est un conseil :
ce sont des calculs sur le passé, qui ne garantissent pas l'avenir.

Hypothèses du test (prudentes et réalistes) :
  - le signal est connu à la clôture de la séance J ;
  - l'achat se fait au cours de clôture de J+1 (tu vois le signal, tu passes l'ordre le lendemain) ;
  - la revente se fait à la clôture, N séances plus tard ;
  - frais d'un aller-retour inclus (voir FRAIS_*), pas d'opérations qui se chevauchent.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

# Frais par défaut : courtage 0,6 % + TVA 20 % sur le courtage ; taxe 0,1 % à la vente.
COURTAGE = 0.006
FRAIS_ACHAT = COURTAGE * 1.20
FRAIS_VENTE = COURTAGE * 1.20 + 0.001

# Exigences pour qu'une règle soit « validée » sur une valeur.
# Double test : la règle doit être bonne sur toute la période ET sur les 30 % d'historique
# les plus récents, pris à part (contrôle contre les résultats obtenus par hasard).
MIN_OPERATIONS = 10
MIN_TAUX_REUSSITE = 0.55
MIN_GAIN_MOYEN = 0.005        # +0,5 % net en moyenne par opération
PART_RECENTE = 0.30
MIN_OPERATIONS_RECENTES = 4
MIN_TAUX_RECENT = 0.50

# Liquidité minimale pour suggérer une valeur (sinon impossible d'acheter et revendre)
MIN_CAPITAUX_JOUR = 300_000   # MAD échangés en moyenne par séance (3 derniers mois)
MIN_JOURS_ACTIFS = 0.80       # part des séances avec au moins un échange
PART_MAX_CAPITAUX = 0.10      # montant suggéré ≤ 10 % des capitaux échangés par jour


def indicateurs(df: pd.DataFrame) -> pd.DataFrame:
    c, v = df["Cloture"], df["Volume"].fillna(0)
    x = pd.DataFrame(index=df.index)
    x["c"] = c
    x["var"] = c.pct_change()
    x["ratio_vol"] = v / v.shift(1).rolling(63, min_periods=20).mean()
    d = c.diff()
    hausse = d.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean()
    baisse = (-d.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean()
    x["rsi"] = 100 - 100 / (1 + hausse / baisse.replace(0, np.nan))
    x["mm20"] = c.rolling(20).mean()
    x["mm50"] = c.rolling(50).mean()
    x["haut20"] = c.shift(1).rolling(20).max()
    x["var3"] = c.pct_change(3)
    return x


@dataclass
class Regle:
    code: str
    nom: str
    sens: str                  # "achat" ou "vente"
    duree: int                 # séances de détention dans le test
    explication: str
    condition: Callable[[pd.DataFrame], pd.Series]


REGLES = [
    Regle("rebond", "Rebond après forte chute", "achat", 5,
          "La valeur a perdu 8 % ou plus en 3 séances avec un volume au moins 1,5 fois la moyenne.",
          lambda x: (x["var3"] <= -0.08) & (x["ratio_vol"] >= 1.5)),
    Regle("rsi_sortie", "Sortie de survente (RSI)", "achat", 10,
          "Le RSI 14 repasse au-dessus de 30 après être descendu en dessous.",
          lambda x: (x["rsi"] > 30) & (x["rsi"].shift(1) <= 30)),
    Regle("cassure", "Cassure du plus haut 20 séances", "achat", 10,
          "La clôture dépasse le plus haut des 20 dernières séances avec un volume supérieur à la moyenne.",
          lambda x: (x["c"] > x["haut20"]) & (x["ratio_vol"] >= 1.5)),
    Regle("croisement", "Croisement MM20 au-dessus de MM50", "achat", 20,
          "La moyenne mobile 20 séances passe au-dessus de la moyenne 50 séances.",
          lambda x: (x["mm20"] > x["mm50"]) & (x["mm20"].shift(1) <= x["mm50"].shift(1))),
    Regle("rsi_haut", "Essoufflement (RSI repasse sous 70)", "vente", 5,
          "Le RSI 14 redescend sous 70 après être monté au-dessus.",
          lambda x: (x["rsi"] < 70) & (x["rsi"].shift(1) >= 70)),
    Regle("sous_mm50", "Passage sous la MM50", "vente", 10,
          "La clôture passe sous la moyenne mobile 50 séances.",
          lambda x: (x["c"] < x["mm50"]) & (x["c"].shift(1) >= x["mm50"].shift(1))),
    Regle("chute_volume", "Forte baisse avec gros volume", "vente", 5,
          "Baisse de 5 % ou plus sur la séance avec un volume au moins 2 fois la moyenne.",
          lambda x: (x["var"] <= -0.05) & (x["ratio_vol"] >= 2)),
]


def operations(regle: Regle, x: pd.DataFrame) -> list[tuple[int, float]]:
    """Rejoue la règle sur tout l'historique : liste (indice du signal, résultat).
    Achat : gain net d'un achat à J+1 revendu N séances plus tard, frais inclus.
    Vente : variation du cours sur les N séances suivantes (négative = vendre a payé)."""
    signaux = regle.condition(x).fillna(False).to_numpy()
    prix = x["c"].to_numpy()
    n, i, res = len(prix), 0, []
    while i < n:
        if signaux[i] and i + 1 + regle.duree < n:
            entree, sortie = prix[i + 1], prix[i + 1 + regle.duree]
            if regle.sens == "achat":
                res.append((i, sortie * (1 - FRAIS_VENTE) / (entree * (1 + FRAIS_ACHAT)) - 1))
            else:
                res.append((i, sortie / entree - 1))
            i += 1 + regle.duree          # pas de chevauchement
        else:
            i += 1
    return res


def statistiques(regle: Regle, r: np.ndarray) -> dict:
    if not len(r):
        return {"operations": 0, "taux_reussite": None, "gain_moyen": None, "gain_median": None,
                "pire": None, "meilleur": None, "gain_median_gagnants": None}
    reussite = (r > 0).mean() if regle.sens == "achat" else (r < 0).mean()
    gagnants = r[r > 0] if regle.sens == "achat" else r[r < 0]
    return {
        "operations": int(len(r)),
        "taux_reussite": round(float(reussite) * 100, 1),
        "gain_moyen": round(float(r.mean()) * 100, 2),
        "gain_median": round(float(np.median(r)) * 100, 2),
        "pire": round(float(r.min() if regle.sens == "achat" else r.max()) * 100, 2),
        "meilleur": round(float(r.max() if regle.sens == "achat" else r.min()) * 100, 2),
        "gain_median_gagnants": round(float(np.median(gagnants)) * 100, 2) if len(gagnants) else None,
    }


def tester(regle: Regle, x: pd.DataFrame) -> dict:
    ops = operations(regle, x)
    coupure = int(len(x) * (1 - PART_RECENTE))
    tout = np.array([r for _, r in ops])
    recent = np.array([r for i, r in ops if i >= coupure])
    st = statistiques(regle, tout)
    st["recent"] = statistiques(regle, recent)
    st["debut_recent"] = x.index[coupure].strftime("%Y-%m-%d") if len(x) else None
    return st


def verdict(regle: Regle, st: dict, liquide: bool) -> tuple[bool, str, dict]:
    """(validée ?, explication en français, {"code", ...paramètres} pour la traduction)."""
    signe = 1 if regle.sens == "achat" else -1
    rec = st["recent"]
    if st["operations"] < MIN_OPERATIONS:
        return False, f"trop peu d'opérations dans l'historique ({st['operations']} < {MIN_OPERATIONS})", \
            {"code": "peu_ops", "n": st["operations"], "min": MIN_OPERATIONS}
    if st["taux_reussite"] < MIN_TAUX_REUSSITE * 100:
        return False, f"taux de réussite insuffisant ({st['taux_reussite']:.0f} %)", \
            {"code": "taux", "t": st["taux_reussite"]}
    if signe * st["gain_moyen"] < MIN_GAIN_MOYEN * 100:
        if regle.sens == "achat":
            return False, "résultat moyen trop faible après frais", {"code": "gain_faible_achat"}
        return False, "baisse moyenne trop faible ensuite", {"code": "gain_faible_vente"}
    if rec["operations"] < MIN_OPERATIONS_RECENTES:
        return False, f"pas assez d'opérations sur la période récente ({rec['operations']})", \
            {"code": "peu_ops_recent", "n": rec["operations"]}
    if rec["taux_reussite"] < MIN_TAUX_RECENT * 100 or signe * rec["gain_moyen"] <= 0:
        return False, "ne marche plus sur la période récente", {"code": "ne_marche_plus"}
    if regle.sens == "achat" and not liquide:
        return False, "valeur trop peu échangée pour acheter et revendre facilement", {"code": "peu_liquide"}
    return True, "validée sur tout l'historique et sur la période récente", {"code": "validee"}


def atr(df: pd.DataFrame, n: int = 14):
    """Average True Range : amplitude « normale » d'une séance, en MAD."""
    h, b, c = df["Haut"], df["Bas"], df["Cloture"]
    if h.isna().all() or b.isna().all():
        return float(c.pct_change().abs().tail(n).mean() * c.iloc[-1])
    tr = pd.concat([h - b, (h - c.shift()).abs(), (b - c.shift()).abs()], axis=1).max(axis=1)
    return float(tr.tail(n).mean())


def plan(df: pd.DataFrame, regle: Regle, st: dict, capitaux_moy) -> dict:
    """Plan indicatif pour une suggestion d'achat : référence, sortie si erreur, objectif, durée."""
    cours = float(df["Cloture"].iloc[-1])
    a = atr(df)
    stop_pct = min(max(2 * a / cours, 0.03), 0.12)                    # 2 ATR, entre 3 % et 12 %
    obj = st.get("gain_median_gagnants") or 0
    objectif_pct = max(obj / 100 + FRAIS_ACHAT + FRAIS_VENTE, stop_pct)  # au moins autant que le risque
    return {
        "entree": round(cours, 2),
        "stop": round(cours * (1 - stop_pct), 2), "stop_pct": round(-stop_pct * 100, 2),
        "objectif": round(cours * (1 + objectif_pct), 2), "objectif_pct": round(objectif_pct * 100, 2),
        "duree": regle.duree,
        "montant_max_liquidite": round(capitaux_moy * PART_MAX_CAPITAUX, -3) if capitaux_moy else None,
    }


def analyser(df: pd.DataFrame, a_jour: bool = True) -> dict:
    """Signaux du jour + statistiques de toutes les règles pour une valeur."""
    x = indicateurs(df)
    profil = profil_court_terme(df)
    liquide = (profil["capitaux_moy"] or 0) >= MIN_CAPITAUX_JOUR and \
              (profil["jours_actifs_pct"] or 0) >= MIN_JOURS_ACTIFS * 100
    regles, suggestions = [], []
    for r in REGLES:
        st = tester(r, x)
        actif = bool(a_jour and r.condition(x).fillna(False).iloc[-1])
        ok, motif, motif_i18n = verdict(r, st, liquide)
        fiche = {"code": r.code, "nom": r.nom, "sens": r.sens, "duree": r.duree,
                 "explication": r.explication, "actif": actif, "fiable": ok, "motif": motif,
                 "motif_i18n": motif_i18n, **st}
        regles.append(fiche)
        if actif:
            sug = dict(fiche)
            if r.sens == "achat":
                sug["plan"] = plan(df, r, st, profil["capitaux_moy"])
            suggestions.append(sug)
    return {"regles": regles, "suggestions": suggestions, "liquide": liquide, **profil}


def profil_court_terme(df: pd.DataFrame) -> dict:
    """Ce qui compte pour l'achat-revente rapide : amplitude dans la séance et liquidité."""
    d = df.tail(60)
    amp = ((d["Haut"] - d["Bas"]) / d["Bas"]).replace([np.inf, -np.inf], np.nan).dropna()
    capitaux = d["Capitaux"].fillna(0) if "Capitaux" in d else (d["Volume"].fillna(0) * d["Cloture"])
    jours_actifs = (d["Volume"].fillna(0) > 0).mean() if len(d) else 0
    return {
        "amplitude_moy": round(float(amp.mean()) * 100, 2) if len(amp) else None,
        "capitaux_moy": round(float(capitaux.mean()), 0) if len(d) else None,
        "jours_actifs_pct": round(float(jours_actifs) * 100, 0),
    }
