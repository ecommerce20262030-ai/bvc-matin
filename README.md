# BVC Matin

Chaque jour ouvré, l'application télécharge les cours de **toutes les actions de la
Bourse de Casablanca** (79 valeurs, liste dans `valeurs.csv`), fait le diagnostic de
chacune et publie une page web que tu ouvres sur ton téléphone ou ton PC.

## Comment ça marche

```
 GitHub (gratuit, toujours allumé)                         Toi
 ┌──────────────────────────────────────────┐
 │ 8h00 et 16h00, lundi → vendredi           │
 │  1. collecte   : cours des 79 valeurs     │
 │                  + indice MASI (Medias24) │
 │  2. diagnostic : variations, 52 semaines, │      📱 téléphone
 │                  volumes, RSI, MM50/200,  │ ───▶ 💻 PC
 │                  signaux                  │      (même adresse web)
 │  3. publication: page web + Excel         │
 └──────────────────────────────────────────┘
```

Pas besoin que ton téléphone ou ton PC soit allumé : tout tourne chez GitHub.
L'application s'utilise sur **iPhone, Android et PC** (même adresse, même contenu).
Elle est **bilingue français / arabe** : bouton « ع / FR » en haut à droite ; en arabe tout
s'affiche de droite à gauche. Le choix est mémorisé sur chaque appareil (par défaut, la langue
du téléphone). Les textes sont dans `app/i18n.js`.

## Installation (une seule fois, environ 10 minutes)

1. Crée un compte gratuit sur **github.com**.
2. Crée un nouveau dépôt (bouton **New**), nom : `bvc-matin`, visibilité **Public**
   (GitHub Pages est gratuit pour les dépôts publics).
3. Dans le dépôt : **Add file → Upload files**, glisse tout le contenu de ce dossier
   (y compris le dossier `.github`), puis **Commit changes**.
   Sur Windows, le dossier `.github` est parfois masqué : active « Éléments masqués »
   dans l'explorateur avant de glisser les fichiers.
4. **Settings → Pages → Source : GitHub Actions**.
5. **Actions → BVC Matin → Run workflow** pour lancer la première mise à jour.
6. Après 3 à 5 minutes, ta page est en ligne à l'adresse :
   `https://TON-NOM-GITHUB.github.io/bvc-matin/`

L'installation se fait plus facilement depuis un ordinateur (une seule fois). Depuis un
téléphone, le site de GitHub ne garde pas toujours les dossiers lors de l'envoi de fichiers.

### Installer l'application sur le téléphone

- **iPhone** : ouvre l'adresse dans **Safari** (pas Chrome) → bouton Partager ⬆ →
  « Sur l'écran d'accueil » → Ajouter.
- **Android** : ouvre l'adresse dans **Chrome** → menu ⋮ → « Installer l'application »
  (ou « Ajouter à l'écran d'accueil »).

L'icône « BVC Matin » s'ouvre alors en plein écran comme une application, et la dernière
version consultée reste lisible sans connexion.

## Les 5 écrans

- **Accueil** : MASI, alertes de ton portefeuille, plus fortes baisses, suggestions d'achat validées,
  hausses, volumes inhabituels, valeurs proches de leur plus bas / plus haut annuel.
- **Suggestions** : les règles techniques déclenchées à la dernière séance, avec leurs résultats
  sur tout l'historique de la valeur (nombre d'opérations, % gagnantes, gain moyen net de frais, pire cas).
  « Validée » = sur tout l'historique : au moins 10 opérations, 55 % gagnantes et gain moyen > +0,5 %
  après frais ; ET sur les 30 % d'historique les plus récents pris à part : au moins 4 opérations,
  50 % gagnantes et gain moyen positif ; ET, pour un achat, une valeur assez échangée
  (≥ 300 000 MAD par jour en moyenne, échanges sur au moins 80 % des séances).
  Chaque suggestion d'achat est accompagnée d'un **plan indicatif** (référence, seuil de sortie
  à 2 ATR, objectif, durée) et d'un **montant** calculé pour que la perte au seuil de sortie
  reste sous le pourcentage de capital choisi dans les Réglages.
- **Bilan des suggestions** (dans l'onglet Suggestions) :
  - *bilan réel* : chaque suggestion validée est inscrite dans `data/suivi_suggestions.csv`
    puis suivie jusqu'à sa sortie ; ce fichier est enregistré dans le dépôt à chaque mise à jour ;
  - *bilan reconstitué* : les 120 dernières séances rejouées comme si l'application avait
    tourné chaque jour, avec une validation qui n'utilise que les données connues à ce moment.
- **Portefeuille** : tes achats, la plus-value nette si tu vends, et des alertes
  (seuil de perte, objectif de gain, signal de vente, forte baisse, valeur non échangée).
  Les données restent sur ton appareil ; « Sauvegarder / Restaurer » pour passer du téléphone au PC.
- **Simulation** : un compte fictif (1 000 000 MAD par défaut) pour acheter et vendre avec les vrais
  cours et les vrais frais, sans risque.
- **Valeurs** : les 79 valeurs, recherche, tri (dont amplitude dans la séance et liquidité), et la
  fiche complète de chacune (graphique 1 an / 5 ans / depuis 2011, règles testées, lien actualités).

Les règles et leurs seuils sont dans `app/strategies.py` ; les frais utilisés pour les tests aussi.

## Détail des indicateurs

- **MASI** : niveau, variation de la séance, depuis le 1er janvier, nombre de valeurs en hausse / en baisse.
- **Résumé** : plus fortes baisses, plus fortes hausses, volumes inhabituels,
  valeurs avec le plus de signaux, valeurs proches de leur plus bas ou plus haut annuel.
- **Toutes les valeurs** : recherche, tri, filtres. Touche une valeur pour son diagnostic complet
  (graphique 1 an, variations 5 j / 1 mois / 1er janv. / 1 an, plus haut et plus bas 52 semaines,
  volume, RSI 14, moyennes mobiles 50 et 200 séances, volatilité, signaux).
- **Excel** : lien en bas de page vers `diagnostic.xlsx`.

Les signaux décrivent des faits (« forte baisse », « volume ×3 la moyenne », « plus bas sur
52 semaines »…). Ce ne sont pas des conseils d'achat ou de vente.

## Ma stratégie (idées du matin et simulateur)

Acheter une valeur **liquide** proche de son **plus bas** et la revendre à **+X %**.
Réglages (onglet Suggestions) : objectif de revente (+1 à +5 %), seuil de sortie (-2, -3 ou -5 %),
durée maximum (dans la journée, 3, 5 ou 10 séances) et montant par opération.

- **Zone d'achat** : capitaux échangés ≥ 300 000 MAD/jour (moyenne 3 mois) ET cours à moins de
  10 % du plus bas sur 52 semaines OU baisse d'au moins 5 % en 5 séances.
- **Test sur les 3 dernières années**, avec les règles d'un vrai carnet d'ordres : ordre d'achat
  à cours limité au cours de clôture de la veille (exécuté seulement si la séance descend à ce
  prix) ; revente dès que le plus haut d'une séance touche l'objectif ; sortie si le plus bas
  touche le seuil (le seuil est retenu en premier si les deux arrivent la même séance) ; sinon
  vente à la clôture de la dernière séance. Frais retirés selon tes réglages.
- **Idées du matin** (Accueil) : les valeurs dans la zone aujourd'hui dont le résultat net moyen
  passé est positif, avec prix d'achat, prix de revente, % d'objectifs atteints, délai médian et
  gain net en MAD pour ton montant.
- **Simulateur** (fiche de chaque valeur) : rejoue tout l'historique avec les réglages de ton choix.

## Dividendes

Le jour du détachement d'un dividende, le cours baisse mécaniquement. L'application le détecte
(écart entre la variation officielle publiée et la variation brute) et corrige l'historique,
pour ne pas y voir une forte baisse ni fausser les règles. Les détachements apparaissent dans
la fiche de chaque valeur. Pour saisir ou corriger un dividende à la main, ajoute une ligne
dans `operations_titres.csv` : `isin,date,dividende` (exemple : `MA0000012445,2026-06-15,19.00`).

## Données à jour ?

Si une mise à jour prévue n'a pas eu lieu, un bandeau rouge l'indique en haut de l'application
avec la date de la séance réellement affichée.

## Horaires

Le fichier `.github/workflows/bvc-matin.yml` lance la mise à jour à 07:00 et 15:00 UTC
(8h00 et 16h00 au Maroc en GMT+1). GitHub peut retarder une exécution de quelques minutes.
À 8h, la page montre le bilan de la séance de la veille ; à 16h, celui du jour.

## Ajouter une valeur (nouvelle introduction en bourse)

Ajoute une ligne `Nom,ISIN` dans `valeurs.csv`. Le code ISIN figure sur la fiche
de la valeur sur casablanca-bourse.com.

## Tester sur un ordinateur

```
pip install -r requirements.txt
python lancer.py            # vraies données -> dossier site/
python lancer.py --demo     # données simulées, sans Internet
```

Puis ouvre `site/index.html` dans le navigateur.

## En cas de problème

- Une valeur manque : elle est listée en bas de la page (« Non disponibles aujourd'hui »).
- La page n'est plus mise à jour : onglet **Actions** du dépôt, ouvre la dernière exécution
  et regarde l'étape « Collecte et diagnostic ». Si la source bloque les serveurs de GitHub,
  le programme peut tourner sur ton PC avec `python lancer.py`.
