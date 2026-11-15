"""Collecte des cours : API officielle de la Bourse de Casablanca (casablanca-bourse.com).

Pour chaque action, l'historique quotidien des 3 dernières années (profondeur maximale
gratuite) : ouverture, plus haut, plus bas, dernier cours, titres et capitaux échangés,
capitalisation. Les cours sont demandés AJUSTÉS (isCoursAjuste=true) : la Bourse corrige
elle-même les dividendes et opérations sur titres.

Chaque valeur est téléchargée séparément ; une erreur sur l'une n'arrête jamais les autres.

Note technique : le certificat HTTPS du site de la Bourse est incomplet (chaîne de
certification non fournie), ce qui fait échouer la vérification standard. Les données
sont publiques et en lecture seule ; la vérification est donc désactivée pour ce seul site.
"""
from __future__ import annotations

import csv
import logging
import time
import warnings
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.exceptions import InsecureRequestWarning
from urllib3.util.retry import Retry

warnings.filterwarnings("ignore", category=InsecureRequestWarning)

BASE = "https://www.casablanca-bourse.com"
URL_HISTORIQUE = BASE + "/api/boursenova/stock-historical"
TIMEOUT = 40
PAUSE = 0.6                 # secondes entre deux requêtes (courtoisie envers le serveur)
PROFONDEUR_JOURS = 3 * 365  # profondeur maximale de l'historique gratuit

log = logging.getLogger("bvc")


@dataclass
class Serie:
    nom: str
    isin: str               # identifiant de la valeur : ici le symbole boursier (ATW, IAM...)
    donnees: pd.DataFrame = field(default_factory=pd.DataFrame)
    erreur: str = ""
    evenements: list = field(default_factory=list)


def lire_valeurs(chemin: str | Path) -> list[tuple[str, str]]:
    """Lit valeurs.csv (colonnes : nom, symbole)."""
    with open(chemin, encoding="utf-8") as f:
        lignes = list(csv.DictReader(f))
    cle = "symbole" if lignes and "symbole" in lignes[0] else "isin"
    return [(r["nom"].strip(), r[cle].strip()) for r in lignes if r.get(cle, "").strip()]


def creer_session() -> requests.Session:
    """Session HTTP avec réessais automatiques et temporisation exponentielle."""
    s = requests.Session()
    retry = Retry(total=5, backoff_factor=1.5, status_forcelist=(429, 500, 502, 503, 504),
                  allowed_methods=("GET",), respect_retry_after_header=True)
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.verify = False
    s.headers.update({
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"),
        "Accept": "application/json, text/plain, */*",
        "Referer": BASE + "/market-data/cours",
    })
    return s


def convertir(items: list[dict]) -> pd.DataFrame:
    """Réponse de l'API -> colonnes standard, index Date trié, sans doublon."""
    if not items:
        return pd.DataFrame()
    df = pd.DataFrame(items)
    out = pd.DataFrame({
        "Date": pd.to_datetime(df["seance"], format="%d/%m/%Y", errors="coerce"),
        "Ouverture": pd.to_numeric(df.get("ouverture"), errors="coerce"),
        "Cloture": pd.to_numeric(df.get("dernierCours"), errors="coerce"),
        "Haut": pd.to_numeric(df.get("plusHaut"), errors="coerce"),
        "Bas": pd.to_numeric(df.get("plusBas"), errors="coerce"),
        "Variation": float("nan"),
        "Volume": pd.to_numeric(df.get("titresEchanges"), errors="coerce"),
        "Capitaux": pd.to_numeric(df.get("volumeEchanges"), errors="coerce"),
        "Capitalisation": pd.to_numeric(df.get("capitalisation"), errors="coerce"),
    })
    out = (out.dropna(subset=["Date", "Cloture"]).query("Cloture > 0")
           .drop_duplicates("Date", keep="first").sort_values("Date").set_index("Date"))
    # Séance sans échange : plus haut / plus bas absents -> on reprend le dernier cours
    for col in ("Haut", "Bas", "Ouverture"):
        out[col] = out[col].where(out[col] > 0, out["Cloture"])
    return out


def telecharger_valeur(session, symbole: str, debut: date, fin: date) -> pd.DataFrame:
    rep = session.get(URL_HISTORIQUE, timeout=TIMEOUT, params={
        "instrument": symbole, "market": "comptant", "type": "actions",
        "startDate": debut.isoformat(), "endDate": fin.isoformat(), "isCoursAjuste": "true"})
    rep.raise_for_status()
    data = rep.json()
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        raise ValueError("format de réponse inattendu")
    return convertir(data["items"])


def indice_marche(series: list[Serie]) -> pd.Series:
    """Capitalisation totale du marché (Mds MAD), à partir des données officielles.
    Ne garde que les séances où au moins 90 % des valeurs ont une capitalisation."""
    caps = {s.isin: s.donnees["Capitalisation"] for s in series
            if not s.donnees.empty and "Capitalisation" in s.donnees}
    if not caps:
        return pd.Series(dtype=float)
    tab = pd.DataFrame(caps).sort_index().ffill(limit=5)
    complet = tab.notna().sum(axis=1) >= 0.9 * tab.shape[1]
    return (tab[complet].sum(axis=1) / 1e9).dropna()


def collecter(valeurs: list[tuple[str, str]], session=None) -> tuple[list[Serie], pd.Series]:
    session = session or creer_session()
    fin = date.today()
    debut = fin - timedelta(days=PROFONDEUR_JOURS)
    series = []
    for i, (nom, symbole) in enumerate(valeurs, 1):
        s = Serie(nom, symbole)
        try:
            s.donnees = telecharger_valeur(session, symbole, debut, fin)
            if s.donnees.empty:
                s.erreur = "aucune donnée renvoyée"
        except Exception as e:
            s.erreur = str(e)[:200]
        log.info("[%2d/%d] %-28s %s", i, len(valeurs), nom,
                 f"{len(s.donnees)} séances" if not s.erreur else "ÉCHEC : " + s.erreur)
        series.append(s)
        time.sleep(PAUSE)
    return series, indice_marche(series)
