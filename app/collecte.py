"""Collecte des cours : API publique Medias24, interrogée par code ISIN.

Chaque valeur est téléchargée séparément ; une erreur sur l'une n'arrête jamais
les autres. Les échecs sont consignés dans le journal de la séance.
"""
from __future__ import annotations

import csv
import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

URL_API = "https://medias24.com/content/api"
TIMEOUT = 20
PAUSE = 0.8                 # secondes entre deux requêtes (courtoisie envers le serveur)
DEBUT_HISTORIQUE = date(2011, 9, 18)   # première date disponible chez Medias24

log = logging.getLogger("bvc")


@dataclass
class Serie:
    nom: str
    isin: str
    donnees: pd.DataFrame = field(default_factory=pd.DataFrame)
    erreur: str = ""
    evenements: list = field(default_factory=list)   # dividendes / opérations détectés


def lire_valeurs(chemin: str | Path) -> list[tuple[str, str]]:
    """Lit valeurs.csv (colonnes : nom, isin)."""
    with open(chemin, encoding="utf-8") as f:
        return [(r["nom"].strip(), r["isin"].strip()) for r in csv.DictReader(f) if r.get("isin")]


def creer_session() -> requests.Session:
    """Session HTTP avec réessais automatiques et temporisation exponentielle."""
    s = requests.Session()
    retry = Retry(total=5, backoff_factor=1.0, status_forcelist=(429, 500, 502, 503, 504),
                  allowed_methods=("GET",), respect_retry_after_header=True)
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers.update({
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/124 Safari/537.36"),
        "Accept": "application/json, text/plain, */*",
    })
    return s


def _json(rep: requests.Response) -> dict:
    """Décode le JSON, même s'il est enveloppé dans du HTML."""
    try:
        return rep.json()
    except ValueError:
        m = re.search(r'(\{.*"result".*\})', rep.text, flags=re.S)
        if not m:
            raise ValueError("réponse non-JSON (blocage, maintenance ou page HTML)")
        return json.loads(m.group(1))


def _nombre(s: pd.Series) -> pd.Series:
    """'1 234,50' / '-0,85 %' / 1234.5 -> float."""
    if pd.api.types.is_numeric_dtype(s):
        return s.astype(float)
    s = (s.astype(str).str.replace(r"[\s  %]", "", regex=True)
         .str.replace(",", ".", regex=False))
    return pd.to_numeric(s, errors="coerce")


ALIAS = {"date": "Date", "seance": "Date",
         "value": "Cloture", "cours": "Cloture", "close": "Cloture", "cloture": "Cloture",
         "max": "Haut", "high": "Haut", "min": "Bas", "low": "Bas",
         "variation": "Variation", "volume": "Volume", "vol": "Volume"}


def nettoyer(brut: pd.DataFrame) -> pd.DataFrame:
    """Colonnes standard (Cloture, Haut, Bas, Variation, Volume), index Date trié, sans doublon."""
    if brut is None or brut.empty:
        return pd.DataFrame()
    df = brut.rename(columns={c: ALIAS[str(c).strip().lower()]
                              for c in brut.columns if str(c).strip().lower() in ALIAS})
    df = df.loc[:, ~df.columns.duplicated()]
    if "Date" not in df or "Cloture" not in df:
        raise ValueError(f"colonnes inattendues : {list(brut.columns)}")
    df["Date"] = pd.to_datetime(df["Date"], dayfirst=True, errors="coerce").dt.normalize()
    for c in ("Cloture", "Haut", "Bas", "Variation", "Volume"):
        df[c] = _nombre(df[c]) if c in df else float("nan")
    df = (df.dropna(subset=["Date", "Cloture"]).query("Cloture > 0")
          .drop_duplicates("Date", keep="last").sort_values("Date").set_index("Date"))
    return df[["Cloture", "Haut", "Bas", "Variation", "Volume"]]


def telecharger_valeur(session, isin: str, debut: date, fin: date) -> pd.DataFrame:
    rep = session.get(URL_API, timeout=TIMEOUT, params={
        "method": "getPriceHistory", "ISIN": isin, "format": "json",
        "from": debut.isoformat(), "to": fin.isoformat()})
    rep.raise_for_status()
    lignes = _json(rep).get("result")
    if not isinstance(lignes, list):
        raise ValueError("format de réponse inattendu")
    return nettoyer(pd.DataFrame(lignes))


def telecharger_masi(session) -> pd.Series:
    """Historique de l'indice MASI (1 an). Renvoie une série vide en cas d'échec."""
    try:
        rep = session.get(URL_API, timeout=TIMEOUT,
                          params={"method": "getMasiHistory", "periode": "1y", "format": "json"})
        rep.raise_for_status()
        res = _json(rep).get("result")
        if isinstance(res, dict) and isinstance(res.get("labels"), list):
            dates = [datetime.fromtimestamp(int(x)).date() for x in res["labels"]]
            valeurs = next(v for k, v in res.items() if k != "labels" and isinstance(v, list))
            if valeurs and isinstance(valeurs[0], list):
                valeurs = valeurs[0]
            s = pd.Series(pd.to_numeric(valeurs, errors="coerce"), index=pd.to_datetime(dates))
        elif isinstance(res, list):
            s = nettoyer(pd.DataFrame(res))["Cloture"]
        else:
            raise ValueError("format inattendu")
        return s.dropna().sort_index()
    except Exception as e:
        log.warning("MASI indisponible : %s", e)
        return pd.Series(dtype=float)


def collecter(valeurs: list[tuple[str, str]], session=None) -> tuple[list[Serie], pd.Series]:
    session = session or creer_session()
    fin = date.today()
    debut = DEBUT_HISTORIQUE
    series = []
    for i, (nom, isin) in enumerate(valeurs, 1):
        s = Serie(nom, isin)
        try:
            s.donnees = telecharger_valeur(session, isin, debut, fin)
            if s.donnees.empty:
                s.erreur = "aucune donnée renvoyée"
        except Exception as e:
            s.erreur = str(e)[:200]
        log.info("[%2d/%d] %-18s %s", i, len(valeurs), nom,
                 f"{len(s.donnees)} séances" if not s.erreur else "ÉCHEC : " + s.erreur)
        series.append(s)
        time.sleep(PAUSE)
    return series, telecharger_masi(session)
