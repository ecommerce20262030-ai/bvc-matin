"""Contrôle automatique du site généré (vraies données), après chaque mise à jour.

Ouvre le site comme un téléphone (390 px), parcourt les onglets, touche les boutons de l'IA
(sans clé : réponses calculées par l'application), vérifie un ordre, analyse une valeur,
passe en arabe. Écrit le résultat dans data/controle.json. Ne bloque jamais la publication.
"""
from __future__ import annotations

import functools
import http.server
import json
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = Path(sys.argv[1] if len(sys.argv) > 1 else "site").resolve()
SORTIE = Path(sys.argv[2] if len(sys.argv) > 2 else "data/controle.json")


def serveur():
    class Muet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    h = functools.partial(Muet, directory=str(SITE))
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def main() -> int:
    s = serveur()
    url = f"http://127.0.0.1:{s.server_address[1]}/index.html"
    r = {"date": datetime.now(timezone.utc).isoformat(timespec="minutes"), "etapes": {}, "erreurs_page": [], "debordements": {}}
    BAD = ("undefined", "NaN", "null", "[object")

    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_page(viewport={"width": 390, "height": 844})
        p.on("pageerror", lambda e: r["erreurs_page"].append(str(e)[:300]))
        p.goto(url)
        p.wait_for_timeout(1500)

        def deborde(nom):
            w = p.evaluate("document.documentElement.scrollWidth")
            if w > 391:
                r["debordements"][nom] = w

        def derniere():
            return p.evaluate("""() => { const m = [...document.querySelectorAll('.ia-m')].filter(e => !e.classList.contains('u'));
                                       return (m.length > 1 ? m[m.length - 2] : m[m.length - 1])?.innerText || ''; }""")

        def etape(nom, fn):
            try:
                txt = fn() or ""
                ok = bool(txt) and not any(x in txt for x in BAD)
                r["etapes"][nom] = {"ok": ok, "extrait": txt[:600]}
            except Exception as e:  # noqa: BLE001
                r["etapes"][nom] = {"ok": False, "erreur": str(e)[:300]}

        etape("accueil", lambda: p.evaluate("""() => `séance ${D.marche.date_seance} · demo=${D.demo} · ${D.marche.nb_diagnostiquees}/${D.marche.nb_valeurs} valeurs · ${document.querySelectorAll('.prop').length} propositions`"""))
        deborde("aujourdhui")

        def fiche():
            p.locator(".prop, .row").first.click()
            p.wait_for_timeout(800)
            deborde("fiche")
            return p.locator("body").inner_text()[:600]
        etape("fiche", fiche)

        def analyser():
            p.locator('[data-ia="analyser"]').first.click()
            p.wait_for_timeout(800)
            return derniere()
        etape("ia_analyser_valeur", analyser)

        p.click('nav button[data-v="ia"]')
        p.wait_for_timeout(400)
        deborde("ia")
        for i, nom in enumerate(["ia_resume_marche", "ia_portefeuille", "ia_strategie", "ia_baisses"]):
            def chip(i=i):
                p.click(f'.ia-chip[data-i="{i}"]')
                p.wait_for_timeout(500)
                return derniere()
            etape(nom, chip)

        def ordre():
            p.click(".ia-chip[data-ordre]")
            p.wait_for_timeout(300)
            p.fill("#io-qte", "5")
            p.click("#io-go")
            p.wait_for_timeout(600)
            t = derniere()
            if "décision" not in t:
                raise AssertionError("réponse incomplète : " + t[:200])
            return t
        etape("ia_verifier_ordre", ordre)

        p.click('nav button[data-v="pf"]')
        p.wait_for_timeout(300)
        deborde("portefeuille")
        p.click("#b-reglages")
        p.wait_for_timeout(300)
        deborde("reglages")
        p.keyboard.press("Escape")
        p.goto(url)
        p.wait_for_timeout(1000)

        def arabe():
            p.click("#b-langue")
            p.wait_for_timeout(300)
            p.click('nav button[data-v="ia"]')
            p.wait_for_timeout(300)
            p.click('.ia-chip[data-i="0"]')
            p.wait_for_timeout(500)
            deborde("ia_arabe")
            return derniere()
        etape("ia_arabe", arabe)
        b.close()
    s.shutdown()

    r["ok"] = all(e["ok"] for e in r["etapes"].values()) and not r["erreurs_page"] and not r["debordements"]
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v["ok"] for k, v in r["etapes"].items()}, ensure_ascii=False), "| OK" if r["ok"] else "| PROBLÈME")
    return 0


if __name__ == "__main__":
    sys.exit(main())
