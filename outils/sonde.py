"""Sonde n°2 : API officielle de la Bourse de Casablanca depuis GitHub."""
import json, warnings
import requests
warnings.filterwarnings("ignore")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
B = "https://www.casablanca-bourse.com"
H = {"User-Agent": UA, "Accept": "application/vnd.api+json", "Content-Type": "application/vnd.api+json",
     "Referer": B + "/fr/live-market/marche-actions-listing"}

def essai(nom, url, params=None, n=2500, headers=H):
    try:
        r = requests.get(url, params=params, headers=headers, timeout=40, verify=False)
        print(f"\n### {nom}: HTTP {r.status_code} {r.headers.get('content-type')} {len(r.content)} octets")
        print(r.text[:n].replace("\n", " "))
        return r
    except Exception as e:
        print(f"\n### {nom}: ERREUR {e}")

r = essai("accueil", B + "/fr", n=300, headers={"User-Agent": UA})
if r is not None:
    print("__NEXT_DATA__ présent:", "__NEXT_DATA__" in r.text, "| buildId présent:", '"buildId"' in r.text)

essai("market_watch", B + "/api/proxy/fr/api/bourse_data/market_watch", {"page[limit]": "3"})
essai("ticker", B + "/api/proxy/fr/api/bourse/dashboard/ticker", n=1500)

base = [
    ("fields[instrument_history]", "symbol,created,openingPrice,coursCourant,highPrice,lowPrice,cumulTitresEchanges,cumulVolumeEchange,totalTrades,capitalisation,coursAjuste,closingPrice,ratioConsolide"),
    ("fields[instrument]", "symbol,libelleFR,codeISIN"),
    ("include", "symbol"),
    ("sort[date-seance][path]", "created"), ("sort[date-seance][direction]", "DESC"),
    ("filter[instrument-history-class][condition][path]", "symbol.codeClasse.field_code"),
    ("filter[instrument-history-class][condition][value]", "1"),
    ("filter[instrument-history-class][condition][operator]", "="),
    ("filter[published]", "1"),
    ("filter[d1][condition][path]", "field_seance_date"), ("filter[d1][condition][operator]", ">="),
    ("filter[d1][condition][value]", "2026-11-10"),
    ("filter[d2][condition][path]", "field_seance_date"), ("filter[d2][condition][operator]", "<="),
    ("filter[d2][condition][value]", "2026-11-14"),
]
r = essai("historique toutes valeurs (5 jours)", B + "/api/proxy/fr/api/bourse_data/instrument_history",
          base + [("page[offset]", "0"), ("page[limit]", "250")], n=3000)
if r is not None and r.ok:
    d = r.json()
    print("\nNB lignes:", len(d.get("data", [])), "| inclus:", len(d.get("included", [])), "| liens:", list(d.get("links", {})))
    if d.get("included"):
        print("Exemple instrument inclus:", json.dumps(d["included"][0])[:800])
    dates = sorted({x["attributes"].get("created", "")[:10] for x in d.get("data", [])})
    print("Dates:", dates)

r = essai("historique par ISIN (ATW)", B + "/api/proxy/fr/api/bourse_data/instrument_history",
          base[:9] + [("filter[isin][condition][path]", "symbol.codeISIN"), ("filter[isin][condition][operator]", "="),
                      ("filter[isin][condition][value]", "MA0000012445"),
                      ("filter[d1][condition][path]", "field_seance_date"), ("filter[d1][condition][operator]", ">="),
                      ("filter[d1][condition][value]", "2011-01-01"),
                      ("page[offset]", "0"), ("page[limit]", "250")], n=1500)
if r is not None and r.ok:
    d = r.json(); print("\nATW lignes:", len(d.get("data", [])), "| next:", "next" in d.get("links", {}))
