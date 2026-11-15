"""Sonde : quelles sources de cours répondent depuis les serveurs de GitHub ?"""
import json, re, traceback
import requests

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36")

def essai(nom, url, **kw):
    try:
        r = requests.get(url, timeout=30, **kw)
        print(f"\n### {nom}: HTTP {r.status_code} {r.headers.get('content-type')} {len(r.content)} octets")
        print(r.text[:600].replace("\n", " "))
        return r
    except Exception as e:
        print(f"\n### {nom}: ERREUR {e}")

# 1. Medias24 avec des en-têtes de navigateur
essai("medias24 navigateur",
      "https://medias24.com/content/api?method=getPriceHistory&ISIN=MA0000012445&format=json&from=2026-10-01&to=2026-11-14",
      headers={"User-Agent": UA, "Accept": "application/json, text/plain, */*",
               "Referer": "https://medias24.com/leboursier/", "Accept-Language": "fr-FR,fr;q=0.9"})

# 2. Site officiel de la Bourse : page d'accueil -> buildId
r = essai("bourse accueil", "https://www.casablanca-bourse.com/fr", headers={"User-Agent": UA})
build = None
if r is not None and r.ok:
    m = re.search(r'"buildId":"([^"]+)"', r.text)
    build = m.group(1) if m else None
    print("buildId =", build)

H = {"User-Agent": UA, "Accept": "application/vnd.api+json", "Content-Type": "application/vnd.api+json",
     "Referer": "https://www.casablanca-bourse.com/fr/live-market/marche-actions-listing"}
if build:
    r = essai("listing actions (_next)", f"https://www.casablanca-bourse.com/_next/data/{build}/fr/live-market/marche-actions-listing.json",
              headers={"User-Agent": UA})
    if r is not None and r.ok:
        open("listing.json", "w").write(r.text)

# 3. API historique d'un instrument (essai avec la bibliothèque casabourse)
try:
    import casabourse as cb
    print("\n### casabourse fonctions:", [n for n in dir(cb) if not n.startswith("_")][:60])
    df = cb.get_historical_data_auto("ATW", "2026-10-01", "2026-11-14")
    print("\n### casabourse ATW:", type(df), getattr(df, "shape", None))
    print(df.head(5).to_string() if hasattr(df, "head") else df)
    print(df.tail(3).to_string() if hasattr(df, "tail") else "")
except Exception:
    traceback.print_exc()
