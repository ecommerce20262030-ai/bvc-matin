"""Fichier compact pour le conseiller IA (page claude.ai) : data/conseiller.json.

Contient l'essentiel du diagnostic du jour, sans les historiques longs.
Aucune donnée personnelle (le portefeuille reste sur le téléphone).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

CHAMPS = ["nom", "isin", "date", "cours", "var_jour", "var_5j", "var_1m", "var_ytd", "var_1a",
          "haut_52s", "bas_52s", "ecart_haut_52s", "ecart_bas_52s", "volume", "volume_moy_3m",
          "ratio_volume", "rsi14", "mm50", "mm200", "ecart_mm200", "volatilite", "attention",
          "a_jour", "liquide", "amplitude_moy", "capitaux_moy", "jours_actifs_pct"]


def _defaut(o):
    if hasattr(o, "item"):
        return o.item()
    raise TypeError(type(o).__name__)


def compact(diag: dict) -> dict:
    valeurs = []
    for v in diag["valeurs"]:
        x = {k: v.get(k) for k in CHAMPS}
        x["signaux"] = [s.get("texte") for s in v.get("signaux", [])]
        x["regles_actives"] = [{k: s.get(k) for k in ("code", "nom", "sens", "duree", "fiable", "motif",
                                                       "operations", "taux_reussite", "gain_moyen", "plan")}
                               for s in v.get("suggestions", [])]
        st = v.get("strategie") or {}
        x["strategie"] = {"zone": st.get("zone"), "depuis": st.get("depuis"), "grille": st.get("grille", {})}
        x["cours_60"] = (v.get("historique") or [])[-60:]
        x["evenements"] = v.get("evenements", [])[-5:]
        valeurs.append(x)
    m = {k: val for k, val in diag["marche"].items() if k != "masi_historique"}
    return {"genere_le": datetime.now(timezone.utc).isoformat(timespec="minutes"),
            "demo": bool(diag.get("demo")), "marche": m, "valeurs": valeurs,
            "echecs": diag.get("echecs", []),
            "bilan_reconstitue": diag.get("bilan_reconstitue"), "bilan_reel": diag.get("bilan_reel"),
            "grille_def": {"cle": "objectif%|seuil_sortie%|duree_max_seances",
                           "valeurs": "[executes, gagnes_objectif, sorties_seuil, echeances, moy_brute_echeance%, delai_median, ordres_places]",
                           "note": "résultats BRUTS sans frais, sur ~3 ans, achat limite au cours de la veille"}}


def ecrire(diag: dict, chemin: Path) -> Path:
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(compact(diag), ensure_ascii=False, separators=(",", ":"),
                                 default=_defaut), encoding="utf-8")
    return chemin
