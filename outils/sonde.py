"""Sonde n°3 : API boursenova (historique officiel) et page des indices, depuis GitHub."""
import re, warnings, requests
warnings.filterwarnings("ignore")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
B = "https://www.casablanca-bourse.com"
H = {"User-Agent": UA, "Accept": "application/json, text/plain, */*", "Referer": B + "/market-data/cours"}
for sym in ("ATW", "IAM", "MNG"):
    try:
        r = requests.get(B + "/api/boursenova/stock-historical", headers=H, timeout=40, verify=False,
                         params={"instrument": sym, "market": "comptant", "type": "actions",
                                 "startDate": "2023-11-16", "endDate": "2026-11-15", "isCoursAjuste": "true"})
        print(f"### {sym}: HTTP {r.status_code} {len(r.content)} octets :: {r.text[:300]}")
    except Exception as e:
        print(f"### {sym}: ERREUR {e}")
try:
    r = requests.get(B + "/live-market/indices", headers={"User-Agent": UA}, timeout=40, verify=False)
    txt = re.sub(r"<[^>]+>", " ", r.text); txt = re.sub(r"\s+", " ", txt)
    i = txt.find("MASI")
    print(f"### indices: HTTP {r.status_code} :: {txt[i:i+400]}")
except Exception as e:
    print(f"### indices: ERREUR {e}")
