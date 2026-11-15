#!/usr/bin/env python3
"""BVC Matin - collecte, diagnostic et publication de toutes les valeurs de la Bourse de Casablanca.

    python lancer.py                 # vraies données -> dossier site/
    python lancer.py --demo          # données simulées (pour tester sans Internet)
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from app.ajustement import ajuster_tout
from app.collecte import collecter, lire_valeurs
from app.diagnostic import diagnostiquer_tout
from app.suivi import mettre_a_jour_journal, reconstituer, synthese
from app.rendu import ecrire_excel, ecrire_historiques, ecrire_page

RACINE = Path(__file__).parent


def donnees_demo(valeurs):
    """Séries simulées réalistes, pour vérifier l'affichage sans accès aux cours."""
    import numpy as np
    import pandas as pd
    from app.collecte import Serie

    jours = pd.bdate_range(end=pd.Timestamp.today().normalize() - pd.offsets.BDay(1), periods=2200)
    series = []
    for i, (nom, isin) in enumerate(valeurs):
        rng = np.random.default_rng(i + 7)
        r = rng.normal(0.0002, 0.015, len(jours))
        vol = rng.integers(200, 40000, len(jours)).astype(float)
        if i % 3 == 1:                  # valeurs qui « respirent » : petits rebonds réguliers près des plus bas
            for k in range(30, len(r) - 6):
                if r[k - 5:k].sum() <= -0.04:
                    r[k:k + 3] += 0.012
        if i % 4 == 0:                  # quelques valeurs « qui rebondissent » après les chutes
            for k in rng.choice(np.arange(60, len(r) - 20, 20), 25, replace=False):
                r[k:k + 3] -= 0.035     # chute de ~10 % en 3 séances, gros volume...
                vol[k:k + 3] *= 3
                r[k + 4:k + 9] += 0.015  # ... puis rebond
        if i % 8 == 0:                  # chute récente : déclenche le signal de rebond aujourd'hui
            r[-3:] -= 0.035
            vol[-3:] *= 3
        px = np.exp(np.cumsum(r))
        px *= rng.uniform(40, 2500) / px[-1]          # dernier cours entre 40 et 2 500 MAD
        px[-1] *= 1 + rng.normal(0, 0.03)
        if i % 9 == 0:
            vol[-1] *= 5
        ouv = np.r_[px[0], px[:-1]] * (1 + rng.normal(0, 0.004, len(px)))
        haut = np.maximum(ouv, px) * (1 + np.abs(rng.normal(0, 0.009, len(px))))
        bas = np.minimum(ouv, px) * (1 - np.abs(rng.normal(0, 0.009, len(px))))
        df = pd.DataFrame({"Cloture": px.round(2), "Haut": haut.round(2), "Bas": bas.round(2),
                           "Variation": float("nan"), "Volume": vol}, index=jours)
        if i % 23 == 5:
            df = df.iloc[:-1]           # valeur non échangée à la dernière séance
        series.append(Serie(nom, isin, df if i != 3 else pd.DataFrame(),
                            "" if i != 3 else "démo : échec simulé"))
    masi = pd.Series(12000 * np.exp(np.cumsum(np.random.default_rng(1).normal(0.0004, 0.008, len(jours)))),
                     index=jours)
    return series, masi


def main(argv=None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--demo", action="store_true", help="utiliser des données simulées")
    p.add_argument("--sortie", default=str(RACINE / "site"))
    a = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")
    log = logging.getLogger("bvc")

    valeurs = lire_valeurs(RACINE / "valeurs.csv")
    log.info("=== %d valeurs à diagnostiquer ===", len(valeurs))
    series, masi = donnees_demo(valeurs) if a.demo else collecter(valeurs)
    ajuster_tout(series, RACINE)                         # dividendes / opérations sur titres
    diag = diagnostiquer_tout(series, masi)

    # Bilan réel (journal conservé dans le dépôt) et bilan reconstitué
    journal_csv = Path(a.sortie) / "_demo_suivi.csv" if a.demo else RACINE / "data" / "suivi_suggestions.csv"
    diag["bilan_reel"] = synthese(mettre_a_jour_journal(journal_csv, series, diag["valeurs"]))
    diag["bilan_reconstitue"] = synthese(reconstituer(series))
    log.info("Bilan reconstitué : %s", diag["bilan_reconstitue"]["achats_clos"])

    sortie = Path(a.sortie)
    if a.demo:   # la démo tient en un seul fichier : on y joint 500 séances d'historique par valeur
        from app.rendu import serie_json
        diag["historique_demo"] = {x.isin: serie_json(x.donnees.tail(500)) for x in series if not x.donnees.empty}
    ecrire_page(diag, sortie, demo=a.demo)
    ecrire_historiques(series, sortie)
    ecrire_excel(diag, sortie / "diagnostic.xlsx")
    m = diag["marche"]
    log.info("=== %d/%d valeurs diagnostiquées, séance du %s -> %s ===",
             m["nb_diagnostiquees"], m["nb_valeurs"], m["date_seance"], sortie)
    # Échec global si moins de la moitié des valeurs : la page de la veille reste en ligne
    return 0 if m["nb_diagnostiquees"] >= len(valeurs) / 2 else 1


if __name__ == "__main__":
    sys.exit(main())
