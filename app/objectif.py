"""« Ma stratégie » : acheter une valeur liquide près de son plus bas et la revendre à +X %.

Pour chaque valeur, on rejoue tout l'historique avec les règles d'un vrai carnet d'ordres :
  - ZONE D'ACHAT : la valeur est assez échangée (capitaux ≥ 300 000 MAD/jour en moyenne sur
    3 mois) ET elle est proche de son plus bas annuel (≤ +10 %) ou a perdu ≥ 5 % en 5 séances ;
  - ACHAT : ordre à cours limité au cours de clôture de la veille ; il n'est exécuté que si le
    plus bas de la séance suivante descend jusqu'à ce prix (sinon : pas d'opération) ;
  - REVENTE À L'OBJECTIF : ordre de vente à +X % ; exécuté dès que le plus haut d'une séance
    l'atteint (y compris la séance d'achat : c'est l'achat-revente dans la journée) ;
  - SEUIL DE SORTIE : vente si le plus bas touche -Y % ; si l'objectif et le seuil sont touchés
    la même séance, on retient le seuil (hypothèse prudente) ;
  - DURÉE MAX : sinon, vente à la clôture de la N-ième séance.

Les résultats sont stockés BRUTS (sans frais) pour une grille d'objectifs / seuils / durées :
l'application retire ensuite les frais selon les réglages de chacun.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

OBJECTIFS = [1, 1.5, 2, 3, 5]      # % de hausse visée
SEUILS = [2, 3, 5]                 # % de baisse acceptée avant de sortir
DUREES = [1, 3, 5, 10]             # séances maximum (1 = achat et revente dans la journée)

ZONE_ECART_BAS = 0.10              # au plus 10 % au-dessus du plus bas sur 52 semaines
ZONE_BAISSE_5J = -0.05             # ou baisse d'au moins 5 % en 5 séances
CAPITAUX_MIN = 300_000             # MAD échangés par jour en moyenne (3 mois)
DEPUIS = 750                       # nombre de séances étudiées (~3 ans : le marché d'aujourd'hui)


def zone(df: pd.DataFrame) -> pd.Series:
    c, v = df["Cloture"], df["Volume"].fillna(0)
    capitaux = (v * c).rolling(63, min_periods=20).mean()
    bas52 = c.rolling(250, min_periods=120).min()
    pres_du_bas = c <= bas52 * (1 + ZONE_ECART_BAS)
    baisse = c.pct_change(5) <= ZONE_BAISSE_5J
    return ((pres_du_bas | baisse) & (capitaux >= CAPITAUX_MIN)).fillna(False)


def rejouer(c, h, b, signaux, objectif, seuil, duree):
    """Renvoie (nb ordres, nb exécutés, nb objectif, nb seuil, nb échéance,
    somme des résultats bruts à l'échéance en %, liste des délais pour atteindre l'objectif)."""
    n = len(c)
    ordres = executes = gagnes = sorties = echeances = 0
    somme_ech, delais = 0.0, []
    i = 0
    while i < n - 1:
        if not signaux[i]:
            i += 1
            continue
        ordres += 1
        prix = c[i]
        j = i + 1
        if b[j] > prix:                       # l'ordre d'achat n'a pas été servi
            i += 1
            continue
        executes += 1
        cible, stop = prix * (1 + objectif / 100), prix * (1 - seuil / 100)
        fin = min(i + duree, n - 1)
        issue = None
        for k in range(j, fin + 1):
            touche_stop, touche_cible = b[k] <= stop, h[k] >= cible
            if touche_stop:
                issue = "seuil"; sorties += 1; break
            if touche_cible:
                issue = "objectif"; gagnes += 1; delais.append(k - j + 1); break
        if issue is None:
            echeances += 1
            somme_ech += (c[fin] / prix - 1) * 100
        i = fin + 1                            # pas d'opérations qui se chevauchent
    return ordres, executes, gagnes, sorties, echeances, somme_ech, delais


def analyser(df: pd.DataFrame) -> dict:
    """Grille de résultats pour une valeur + est-elle dans la zone d'achat aujourd'hui ?"""
    if len(df) < 300:
        return {}
    d = df.tail(DEPUIS + 260)                  # marge pour les moyennes glissantes
    sig = zone(d)
    d, sig = d.tail(DEPUIS), sig.tail(DEPUIS)
    c = d["Cloture"].to_numpy(float)
    h = d["Haut"].fillna(d["Cloture"]).to_numpy(float)
    b = d["Bas"].fillna(d["Cloture"]).to_numpy(float)
    s = sig.to_numpy(bool)
    grille = {}
    for o in OBJECTIFS:
        for st in SEUILS:
            for du in DUREES:
                ordres, ex, g, so, ech, somme, delais = rejouer(c, h, b, s, o, st, du)
                grille[f"{o}|{st}|{du}"] = [ex, g, so, ech, round(somme / ech, 2) if ech else 0.0,
                                            float(np.median(delais)) if delais else None, ordres]
    return {"zone": bool(sig.iloc[-1]), "grille": grille,
            "depuis": d.index[0].strftime("%Y-%m-%d"), "signaux_zone": int(s.sum())}
