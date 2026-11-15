/* BVC Matin — Conseiller IA intégré.
 *
 * L'IA répond directement dans l'application :
 *   1. Google Gemini (clé gratuite, quota quotidien) en premier ;
 *   2. Claude (Anthropic, clé payante) quand le quota gratuit est épuisé, ou si on le choisit.
 *
 * Les clés sont collées une fois par l'utilisateur et restent dans CE téléphone (localStorage).
 * Elles ne partent que vers l'API correspondante (en en-tête HTTP, jamais dans l'adresse).
 * L'IA lit les données du jour et le portefeuille via des « outils » exécutés dans la page :
 * elle ne voit que ce que ces fonctions renvoient, et ne peut passer aucun ordre.
 */
(() => {
"use strict";

/* ---------- Textes ---------- */
const TX = {
  fr: {
    titre: "Conseiller IA", fermer: "Fermer", reglages: "Clés IA", ph: "Votre question…",
    bienvenue: "Bonjour. Je lis le diagnostic du matin de toutes les valeurs et votre portefeuille. Je peux résumer le marché, analyser une valeur ou vérifier un ordre avant que vous le passiez.",
    avert: "Je ne suis pas un conseiller financier agréé : je donne des faits, des calculs et des risques. La décision vous appartient. Je ne passe aucun ordre.",
    chips: ["Résumé du marché ce matin", "Que surveiller dans mon portefeuille ?", "Ma stratégie +2 % marche-t-elle en ce moment ?", "Quelles valeurs liquides ont le plus baissé ?"],
    chipOrdre: "✓ Vérifier un ordre", raz: "↺ Nouvelle conversation",
    reflexion: "J'analyse…", outil: n => `Je consulte : ${n}…`,
    parGemini: "Gemini · gratuit", parClaude: "Claude · Anthropic",
    bascule: "Quota gratuit épuisé : réponse donnée par Claude (payant).",
    sansCle: "Pour activer l'IA, collez une clé dans « Clés IA ». La clé Gemini est gratuite (2 minutes avec un compte Google).",
    quotaSansClaude: "Le quota gratuit Gemini est épuisé pour aujourd'hui (il revient vers 8h-9h, heure du Maroc). Pour continuer tout de suite, ajoutez une clé Claude dans « Clés IA ».",
    cleKo: p => `La clé ${p} est refusée. Vérifiez-la dans « Clés IA ».`,
    creditKo: "Le crédit Anthropic est épuisé : rechargez-le sur console.anthropic.com (Billing).",
    reseau: "Pas de connexion à l'IA. Vérifiez Internet et réessayez.",
    erreur: m => `L'IA n'a pas pu répondre (${m}). Réessayez.`,
    rgTitre: "Clés de l'IA", rgAide: "Collez chaque clé une seule fois. Elles restent dans ce téléphone et ne sont envoyées qu'à Google ou Anthropic.",
    gTitre: "1. Gemini (gratuit)", gAide: "Sur aistudio.google.com/apikey : connectez-vous avec Google, « Create API key », copiez, collez ici. Sur l'offre gratuite, Google peut utiliser les conversations pour améliorer ses produits.",
    aTitre: "2. Claude (payant, quand le gratuit est épuisé)", aAide: "Sur console.anthropic.com : créez un compte, ajoutez un crédit (Billing), fixez une limite de dépense, puis « API keys » → « Create key ». Facturé à l'usage (quelques centimes par question).",
    mode: "Quelle IA utiliser ?", modeAuto: "Gratuit d'abord, puis Claude", modeG: "Toujours Gemini (gratuit)", modeA: "Toujours Claude",
    enr: "Enregistrer", effacer: "Effacer les clés", ok: "Enregistré.", test: "Tester", testOk: p => `${p} répond.`, testKo: (p, m) => `${p} : ${m}`,
    cle: "Clé", vide: "non renseignée", masquee: "enregistrée",
    claudeai: "Version sur claude.ai (avec votre abonnement)",
    ordTitre: "Vérifier un ordre", ordVal: "Valeur", achat: "Achat", vente: "Vente", prix: "Prix limite (MAD)", qte: "Quantité", obj: "Objectif %", seuil: "Sortie %",
    ordGo: "Vérifier avec l'IA", ordManque: "Indiquez la valeur, le prix et la quantité.",
    ordMsg: o => `Vérifie mon ordre avant que je le passe : ${o.sens === "achat" ? "ACHAT" : "VENTE"} de ${o.qte} ${o.val} à ${o.prix} MAD (objectif +${o.obj} %, sortie à -${o.seuil} %). Donne les faits, les frais, les risques et ce qui plaide pour et contre. La décision m'appartient.`,
    ficheQ: n => `Analyse ${n} pour moi : situation, risques et ce que dit l'historique de ma stratégie.`,
    onbTitre: "Activer l'IA en 2 minutes", onb1: "1. Clé gratuite Gemini", onb1Aide: "Ouvrez aistudio.google.com/apikey avec votre compte Google, touchez « Create API key », copiez la clé et collez-la ici.",
    onb2: "2. Optionnel : clé Claude (payante)", onb2Aide: "Prend le relais quand le quota gratuit du jour est épuisé. À créer sur console.anthropic.com.",
    onbGo: "Enregistrer et tester", testEnCours: "Test en cours…", gerer: "Les clés se gèrent ensuite dans Réglages.",
    statut: "État des clés"
  },
  ar: {
    titre: "المستشار الذكي", fermer: "إغلاق", reglages: "مفاتيح الذكاء", ph: "اكتب سؤالك…",
    bienvenue: "مرحبا. أقرأ تشخيص الصباح لجميع الأسهم ومحفظتك. يمكنني تلخيص السوق، أو تحليل سهم، أو مراجعة أمر قبل تنفيذه.",
    avert: "لست مستشارا ماليا معتمدا: أقدم وقائع وحسابات ومخاطر. القرار لك. لا أنفذ أي أمر.",
    chips: ["ملخص السوق هذا الصباح", "ماذا أراقب في محفظتي؟", "هل استراتيجيتي ‎+2%‎ تنجح حاليا؟", "ما الأسهم السائلة الأكثر انخفاضا؟"],
    chipOrdre: "✓ مراجعة أمر", raz: "↺ محادثة جديدة",
    reflexion: "أحلل…", outil: n => `أطلع على: ${n}…`,
    parGemini: "Gemini · مجاني", parClaude: "Claude · Anthropic",
    bascule: "انتهت الحصة المجانية: الجواب من Claude (مدفوع).",
    sansCle: "لتفعيل الذكاء الاصطناعي، الصق مفتاحا في «مفاتيح الذكاء». مفتاح Gemini مجاني (دقيقتان بحساب Google).",
    quotaSansClaude: "انتهت حصة Gemini المجانية لهذا اليوم (تعود حوالي 8-9 صباحا بتوقيت المغرب). للمتابعة الآن، أضف مفتاح Claude في «مفاتيح الذكاء».",
    cleKo: p => `مفتاح ${p} مرفوض. تحقق منه في «مفاتيح الذكاء».`,
    creditKo: "رصيد Anthropic نفد: أعد الشحن في console.anthropic.com (Billing).",
    reseau: "لا اتصال بالذكاء الاصطناعي. تحقق من الإنترنت وأعد المحاولة.",
    erreur: m => `تعذر الجواب (${m}). أعد المحاولة.`,
    rgTitre: "مفاتيح الذكاء الاصطناعي", rgAide: "الصق كل مفتاح مرة واحدة. تبقى في هذا الهاتف ولا ترسل إلا إلى Google أو Anthropic.",
    gTitre: "1. Gemini (مجاني)", gAide: "في aistudio.google.com/apikey: سجل الدخول بحساب Google، ثم «Create API key»، انسخ والصق هنا. في العرض المجاني قد تستعمل Google المحادثات لتحسين منتجاتها.",
    aTitre: "2. Claude (مدفوع، عند نفاد المجاني)", aAide: "في console.anthropic.com: أنشئ حسابا، أضف رصيدا (Billing)، حدد سقف الإنفاق، ثم «API keys» ← «Create key». الدفع حسب الاستعمال (سنتيمات قليلة لكل سؤال).",
    mode: "أي ذكاء اصطناعي؟", modeAuto: "المجاني أولا ثم Claude", modeG: "دائما Gemini (مجاني)", modeA: "دائما Claude",
    enr: "حفظ", effacer: "مسح المفاتيح", ok: "تم الحفظ.", test: "اختبار", testOk: p => `${p} يجيب.`, testKo: (p, m) => `${p}: ${m}`,
    cle: "المفتاح", vide: "غير مدخل", masquee: "محفوظ",
    claudeai: "النسخة على claude.ai (باشتراكك)",
    ordTitre: "مراجعة أمر", ordVal: "السهم", achat: "شراء", vente: "بيع", prix: "السعر المحدد (درهم)", qte: "الكمية", obj: "الهدف %", seuil: "الخروج %",
    ordGo: "راجع مع الذكاء الاصطناعي", ordManque: "أدخل السهم والسعر والكمية.",
    ordMsg: o => `راجع أمري قبل أن أنفذه: ${o.sens === "achat" ? "شراء" : "بيع"} ${o.qte} من ${o.val} بسعر ${o.prix} درهم (الهدف ‎+${o.obj}%‎، الخروج ‎-${o.seuil}%‎). أعطني الوقائع والعمولات والمخاطر وما يؤيد وما يعارض. القرار لي.`,
    ficheQ: n => `حلل لي ${n}: الوضعية، المخاطر، وما يقوله تاريخ استراتيجيتي.`,
    onbTitre: "فعّل الذكاء الاصطناعي في دقيقتين", onb1: "1. مفتاح Gemini المجاني", onb1Aide: "افتح aistudio.google.com/apikey بحساب Google، اضغط «Create API key»، انسخ المفتاح والصقه هنا.",
    onb2: "2. اختياري: مفتاح Claude (مدفوع)", onb2Aide: "يتولى الأمر عند نفاد الحصة المجانية لليوم. يُنشأ في console.anthropic.com.",
    onbGo: "حفظ واختبار", testEnCours: "جارٍ الاختبار…", gerer: "تُدار المفاتيح بعد ذلك من الإعدادات.",
    statut: "حالة المفاتيح"
  }
};
const x = (k, ...a) => { const v = (TX[LANG] || TX.fr)[k] ?? TX.fr[k]; return typeof v === "function" ? v(...a) : v; };
const ARTIFACT = "https://claude.ai/artifact/PhbA8WfscS1DewHSRDQM2r";

/* ---------- Mémoire locale (ce téléphone uniquement) ---------- */
const st = {
  get(k, d) { try { const v = localStorage.getItem("bvc.ia." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("bvc.ia." + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem("bvc.ia." + k); } catch (e) {} }
};
let CLES = st.get("cles", {gemini: "", anthropic: ""});
let MODE = st.get("mode", "auto");                    // auto | gemini | anthropic
let FIL = st.get("fil", []);                          // [{role: "user"|"assistant", content, par?}]
let busy = false;

/* ---------- Calculs (mêmes règles que le reste de l'application) ---------- */
const r2 = v => v == null || isNaN(v) ? null : Math.round(v * 100) / 100;
const f2 = (v, d = 2) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("fr-FR", {minimumFractionDigits: d, maximumFractionDigits: d});
const proche = (l, v) => l.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
function grille(f, o = R.obj, s = R.seuil, d = R.duree) {
  const ko = proche(OBJ, o), ks = proche(SEU, s), kd = proche(DUR, d);
  const g = f.strategie?.grille?.[`${ko}|${ks}|${kd}`];
  if (!g) return null;
  const [ex, ga, so, ech, moy, med, ordres] = g;
  const b = {config: {objectif_pct: ko, sortie_pct: ks, duree_max_seances: kd}, depuis: f.strategie.depuis, ordres_places: ordres, executes: ex};
  if (!ex) return b;
  return Object.assign(b, {pct_objectif_atteint: r2(ga / ex * 100), pct_sortie_perte: r2(so / ex * 100), pct_vente_echeance: r2(ech / ex * 100),
    delai_median_seances: med, resultat_net_moyen_pct: r2((ga * net(ko) + so * net(-ks) + ech * net(moy)) / ex),
    pct_ordres_executes: ordres ? r2(ex / ordres * 100) : null});
}
function trouver(q) {
  if (!q) return null;
  const n = String(q).trim().toUpperCase();
  return V.find(f => f.isin.toUpperCase() === n) || V.find(f => f.nom.toUpperCase() === n)
    || V.find(f => f.nom.toUpperCase().includes(n)) || (n.length > 3 ? V.find(f => n.includes(f.nom.toUpperCase())) : null);
}
const regles = f => (f.suggestions || []).map(s => ({nom: s.nom, sens: s.sens, validee: s.fiable, motif: s.motif,
  operations_passees: s.operations, reussite_pct: s.taux_reussite, gain_moyen_pct: s.gain_moyen, plan: s.plan}));
const signaux = f => (f.signaux || []).map(s => s.texte);
const court = f => ({symbole: f.isin, nom: f.nom, cours: f.cours, var_jour_pct: f.var_jour, var_5j_pct: f.var_5j,
  ecart_plus_bas_52s_pct: f.ecart_bas_52s, rsi14: f.rsi14, liquide: f.liquide, capitaux_moyens_jour_mad: f.capitaux_moy});

/* ---------- Outils que l'IA peut appeler ---------- */
const OUTILS = [
  {name: "marche_du_jour", label: {fr: "marché du jour", ar: "السوق اليوم"},
   description: "Résumé de la dernière séance : date, nombre de hausses et de baisses, capitalisation totale, plus fortes hausses et baisses, valeurs liquides en zone d'achat de la stratégie avec leur historique net.",
   params: null,
   run() {
     const ok = V.filter(f => f.a_jour && f.var_jour != null).sort((a, b) => a.var_jour - b.var_jour);
     const {masi_historique, ...m} = M;
     return {genere_le: D.genere_le, marche: m, note: "masi = capitalisation boursière totale (milliards MAD) ; le MASI officiel n'est pas disponible",
       plus_fortes_baisses: ok.slice(0, 8).map(court), plus_fortes_hausses: ok.slice(-8).reverse().map(court),
       zone_achat_liquides: V.filter(f => f.strategie?.zone && f.liquide).map(f => ({...court(f), strategie: grille(f)})),
       bilan_regles: (({dernieres, ...b}) => b)(D.bilan_reconstitue || {}), non_diagnostiquees: (D.echecs || []).map(e => e.nom)};
   }},
  {name: "chercher_valeur", label: {fr: "fiche valeur", ar: "بطاقة السهم"},
   description: "Fiche complète d'une valeur (nom ou symbole : MNG, MANAGEM, ATW, IAM…) : cours, variations, plus haut/bas 52 semaines, RSI, moyennes mobiles, volatilité, liquidité, signaux, règles actives, historique de la stratégie de l'utilisateur, 60 derniers cours.",
   params: {type: "object", properties: {valeur: {type: "string", description: "nom ou symbole"}}, required: ["valeur"]},
   run({valeur}) {
     const f = trouver(valeur);
     if (!f) return {introuvable: valeur, valeurs: V.map(v => v.isin + " " + v.nom).join(", ")};
     return {...court(f), derniere_seance: f.date, a_jour: f.a_jour, var_1m_pct: f.var_1m, var_ytd_pct: f.var_ytd, var_1an_pct: f.var_1a,
       plus_haut_52s: f.haut_52s, plus_bas_52s: f.bas_52s, ecart_plus_haut_52s_pct: f.ecart_haut_52s, mm50: f.mm50, mm200: f.mm200,
       volatilite_annuelle_pct: f.volatilite, ratio_volume: f.ratio_volume, seances_actives_pct: f.jours_actifs_pct,
       amplitude_moyenne_seance_pct: f.amplitude_moy, signaux: signaux(f), regles_actives: regles(f),
       dans_zone_achat: f.strategie?.zone, strategie_utilisateur: grille(f), cours_60_seances: (f.historique || []).slice(-60),
       evenements: (f.evenements || []).slice(-5)};
   }},
  {name: "lister_valeurs", label: {fr: "liste des valeurs", ar: "قائمة الأسهم"},
   description: "Liste filtrée. filtre : baisse (plus fortes baisses du jour), hausse, baisse_5j, zone (zone d'achat de la stratégie), signaux_achat, signaux_vente, pres_plus_bas, toutes.",
   params: {type: "object", properties: {filtre: {type: "string", enum: ["baisse", "hausse", "baisse_5j", "zone", "signaux_achat", "signaux_vente", "pres_plus_bas", "toutes"]},
     liquides_seulement: {type: "boolean"}, limite: {type: "integer"}}, required: ["filtre"]},
   run({filtre, liquides_seulement = true, limite = 10}) {
     const l = V.filter(f => !liquides_seulement || f.liquide);
     const par = k => (a, b) => (a[k] ?? 1e9) - (b[k] ?? 1e9);
     const ev = f => grille(f)?.resultat_net_moyen_pct ?? -99;
     const res = {
       baisse: () => l.filter(f => f.a_jour).sort(par("var_jour")),
       hausse: () => l.filter(f => f.a_jour).sort(par("var_jour")).reverse(),
       baisse_5j: () => l.sort(par("var_5j")),
       zone: () => l.filter(f => f.strategie?.zone).sort((a, b) => ev(b) - ev(a)),
       signaux_achat: () => l.filter(f => (f.suggestions || []).some(s => s.sens === "achat")),
       signaux_vente: () => l.filter(f => (f.suggestions || []).some(s => s.sens === "vente")),
       pres_plus_bas: () => l.sort(par("ecart_bas_52s")),
       toutes: () => l.sort((a, b) => a.nom.localeCompare(b.nom))
     }[filtre];
     if (!res) throw new Error("filtre inconnu");
     return res().slice(0, Math.min(40, limite || 12)).map(f => ({...court(f),
       regles_actives: (f.suggestions || []).map(s => `${s.sens}: ${s.nom}${s.fiable ? " (validée)" : " (non validée)"}`),
       strategie_net_moyen_pct: grille(f)?.resultat_net_moyen_pct ?? null}));
   }},
  {name: "verifier_ordre", label: {fr: "vérification de l'ordre", ar: "مراجعة الأمر"},
   description: "Contrôle chiffré d'un ordre AVANT que l'utilisateur le passe : écart au dernier cours, frais réels, prix de revente minimum sans perte, gain/perte nets à l'objectif et à la sortie, poids dans le capital, part des échanges quotidiens, historique de la stratégie sur la valeur, position détenue. Renvoie des alertes automatiques à commenter.",
   params: {type: "object", properties: {valeur: {type: "string"}, sens: {type: "string", enum: ["achat", "vente"]}, prix: {type: "number"}, quantite: {type: "number"},
     objectif_pct: {type: "number"}, sortie_pct: {type: "number"}, duree_max_seances: {type: "number"}}, required: ["valeur", "sens", "prix", "quantite"]},
   run({valeur, sens, prix, quantite, objectif_pct = R.obj, sortie_pct = R.seuil, duree_max_seances = R.duree}) {
     const f = trouver(valeur);
     if (!f) return {introuvable: valeur};
     if (!(prix > 0 && quantite > 0)) throw new Error("prix et quantité doivent être positifs");
     const {fa, fv} = tauxFrais(), montant = prix * quantite, al = [];
     const ecart = (prix / f.cours - 1) * 100;
     const o = {valeur: f.isin + " " + f.nom, sens, prix, quantite, montant_mad: r2(montant), dernier_cours: f.cours, derniere_seance: f.date,
       a_jour: f.a_jour, ecart_dernier_cours_pct: r2(ecart), reglages: {courtage_pct_ht: R.courtage, taxe_vente_pct: R.taxe, capital_mad: R.capital, lignes_max: R.lignes}};
     if (!f.a_jour) al.push("Valeur non échangée à la dernière séance : le cours affiché peut être ancien.");
     if (Math.abs(ecart) > 6) al.push(`Prix limite à ${f2(ecart, 1)} % du dernier cours : risque de non-exécution aujourd'hui (seuils de variation de séance).`);
     if (!f.liquide) al.push("Valeur peu liquide : acheter et revendre au prix voulu peut être difficile.");
     if (f.capitaux_moy) {
       const part = montant / f.capitaux_moy * 100; o.part_capitaux_jour_pct = r2(part);
       if (part > 10) al.push(`L'ordre pèse ${f2(part, 0)} % des capitaux échangés par jour : exécution partielle ou impact sur le prix probables.`);
     }
     if (sens === "achat") {
       const cible = prix * (1 + objectif_pct / 100), stop = prix * (1 - sortie_pct / 100), cout = montant * (1 + fa), pr = prix * (1 + fa) / (1 - fv);
       Object.assign(o, {frais_achat_mad: r2(montant * fa), cout_total_mad: r2(cout), prix_revente_minimum_sans_perte: r2(pr), hausse_minimum_sans_perte_pct: r2((pr / prix - 1) * 100),
         objectif: {pct: objectif_pct, prix: r2(cible), gain_net_mad: r2(cible * quantite * (1 - fv) - cout), gain_net_pct: r2(net(objectif_pct))},
         sortie: {pct: sortie_pct, prix: r2(stop), perte_nette_mad: r2(stop * quantite * (1 - fv) - cout), perte_nette_pct: r2(net(-sortie_pct))},
         poids_capital_pct: r2(cout / R.capital * 100), montant_prevu_par_ligne_mad: r2(R.capital / R.lignes)});
       if (objectif_pct <= (pr / prix - 1) * 100 + 0.2) al.push("L'objectif couvre à peine les frais : gain net quasi nul.");
       if (cout > R.capital / R.lignes * 1.15) al.push(`L'ordre dépasse le montant prévu par ligne (${f2(R.capital / R.lignes, 0)} MAD).`);
       if (f.amplitude_moy && duree_max_seances <= 1 && objectif_pct > f.amplitude_moy * 1.5) al.push(`Objectif de ${objectif_pct} % en une séance, alors que la valeur bouge en moyenne de ${f2(f.amplitude_moy, 1)} % par séance.`);
       const g = grille(f, objectif_pct, sortie_pct, duree_max_seances); o.historique_strategie = g;
       if (g?.resultat_net_moyen_pct != null && g.resultat_net_moyen_pct < 0) al.push(`Sur ~3 ans, cette méthode sur cette valeur a donné en moyenne ${f2(g.resultat_net_moyen_pct)} % net par opération (négatif après frais).`);
       if (g && g.executes < 10) al.push("Trop peu d'opérations passées pour juger la méthode sur cette valeur.");
     } else {
       o.frais_vente_mad = r2(montant * fv); o.produit_net_mad = r2(montant * (1 - fv));
       const pos = PF.filter(p => p.isin === f.isin);
       if (pos.length) {
         const q = pos.reduce((a, p) => a + p.qte, 0), pm = pos.reduce((a, p) => a + p.qte * p.prix, 0) / q, qv = Math.min(quantite, q);
         o.position = {quantite: q, prix_moyen: r2(pm), resultat_net_vente_mad: r2(qv * prix * (1 - fv) - qv * pm * (1 + fa))};
         if (quantite > q) al.push(`Vente de ${quantite} titres alors que le portefeuille n'en contient que ${q}.`);
       } else al.push("Aucune position sur cette valeur dans le portefeuille de l'application.");
     }
     Object.assign(o, {regles_actives: regles(f), signaux: signaux(f), rsi14: f.rsi14, ecart_plus_bas_52s_pct: f.ecart_bas_52s, ecart_plus_haut_52s_pct: f.ecart_haut_52s, alertes_automatiques: al});
     return o;
   }},
  {name: "mon_portefeuille", label: {fr: "portefeuille", ar: "المحفظة"},
   description: "Positions enregistrées dans l'application, évaluées au dernier cours, résultat net frais d'achat et de vente inclus, signaux par ligne.",
   params: null,
   run() {
     if (!PF.length) return {vide: true};
     const {fa, fv} = tauxFrais();
     return {reglages: {capital: R.capital, lignes: R.lignes, courtage: R.courtage, objectif: R.obj, sortie: R.seuil}, positions: PF.map(p => {
       const f = PAR_ISIN[p.isin], c = f?.cours, cout = p.qte * p.prix * (1 + fa), val = c ? p.qte * c * (1 - fv) : null;
       return {symbole: p.isin, nom: p.nom, quantite: p.qte, prix_achat: p.prix, date_achat: p.date, sortie_perso: p.stop, objectif_perso: p.objectif,
         cours: c, var_jour_pct: f?.var_jour, resultat_net_mad: val == null ? null : r2(val - cout), resultat_net_pct: val == null ? null : r2((val / cout - 1) * 100),
         signaux: f ? signaux(f) : [], regles_actives: f ? regles(f).map(r => r.sens + ": " + r.nom) : [], rsi14: f?.rsi14, liquide: f?.liquide};
     })};
   }}
];
function executer(nom, args) {
  const o = OUTILS.find(t => t.name === nom);
  if (!o) return {erreur: "outil inconnu"};
  try { return o.run(args || {}); } catch (e) { return {erreur: e.message}; }
}

/* ---------- Réponses calculées par l'application (sans IA) ----------
 * Les boutons rapides, la vérification d'ordre et l'analyse d'une valeur répondent
 * toujours, même sans clé IA (ou si le quota est épuisé) : l'application calcule
 * elle-même à partir des données du jour. L'IA, quand elle est configurée, va plus loin. */
const AR = () => LANG === "ar";
const sg = v => v == null || isNaN(v) ? "—" : (v > 0 ? "+" : "") + f2(v) + " %";
const mad2 = (v, d = 0) => f2(v, d) + (AR() ? " درهم" : " MAD");
const L = {
  fr: {
    seance: d => `**Séance du ${d}**`, hb: (h, b, s) => `${h} valeurs en hausse, ${b} en baisse, ${s} stables.`,
    cap: (c, v) => `Capitalisation totale : **${c} Mds MAD** (${v} sur la séance).`,
    baisses: "Plus fortes baisses (valeurs liquides) :", hausses: "Plus fortes hausses (valeurs liquides) :",
    zone: (n, k) => `Zone d'achat de votre méthode : **${n}** valeur(s) liquide(s), dont **${k}** avec un résultat net moyen positif sur ~3 ans.`,
    pfVide: "Aucune position enregistrée. Ajoutez vos achats dans l'onglet Portefeuille, je pourrai alors les surveiller.",
    pfTot: (v, c, n, p) => `Valeur si vous vendez tout : **${v}** pour un coût de ${c} : résultat net **${n}** (${p}), frais inclus.`,
    pfLigne: (nom, q, pr, c, vj, n, p) => `**${nom}** : ${q} × ${pr}, cours ${c} (${vj}) → net ${n} (${p})`,
    pfAl: "À surveiller :", pfRien: "Aucune alerte aujourd'hui sur vos positions.",
    strat: (o, s, d) => `Votre méthode : revente à +${o} %, sortie à -${s} %, au plus ${d} séances. Résultats sur ~3 ans, frais inclus :`,
    stratZ: (n, k, m) => `- ${n} valeur(s) liquide(s) sont en zone d'achat aujourd'hui ; ${k} ont un résultat net moyen positif. Moyenne : **${m}** par opération.`,
    stratAll: (n, k, m) => `- Sur l'ensemble des ${n} valeurs liquides testées : ${k} positives, moyenne **${m}** par opération.`,
    stratTop: "Meilleurs historiques parmi la zone d'achat :",
    frais: (a, z) => `Frais aller-retour ≈ **${a}** : il faut au moins **+${z}** de hausse pour ne rien perdre.`,
    stratKo: "Conclusion chiffrée : en moyenne la méthode perd de l'argent après frais en ce moment. Viser plus haut que les frais ou être plus sélectif change le résultat ; testez d'autres réglages dans ⚙️.",
    stratOk: "Conclusion chiffrée : en moyenne la méthode gagne après frais sur ces valeurs, sans garantie pour la suite.",
    bTitre: "Plus fortes baisses de la séance (valeurs liquides) :",
    bLigne: (nom, v, c, e, r) => `**${nom}** : ${v}, cours ${c}, à ${e} de son plus bas 52 sem., RSI ${r}`,
    ordA: (q, nom, p, m) => `**Achat de ${q} ${nom} à ${p}** (montant ${m})`,
    ordV: (q, nom, p, m) => `**Vente de ${q} ${nom} à ${p}** (montant ${m})`,
    ecart: (e, c) => `Écart avec le dernier cours (${c}) : ${e}`,
    fa: (f, t) => `Frais d'achat : ${f} ; coût total : ${t}`,
    pr: (p, z) => `Revente minimum sans perte : **${p}** (${z})`,
    obj: (o, p, g) => `À l'objectif (+${o} %, ${p}) : gain net **${g}**`,
    sor: (s, p, g) => `À la sortie (-${s} %, ${p}) : perte nette **${g}**`,
    poids: (p, l) => `Poids dans votre capital : ${p} (prévu par ligne : ${l})`,
    hist: (n, a, m) => `Votre méthode sur cette valeur (~3 ans) : ${n} opérations, objectif atteint ${a}, net moyen **${m}**`,
    fv: (f, n) => `Frais de vente : ${f} ; vous recevez net : ${n}`,
    pos: (q, pm, r) => `Position détenue : ${q} titres à ${pm} en moyenne ; résultat net de cette vente : **${r}**`,
    att: "**Points d'attention :**", rienAtt: "Aucune alerte automatique.",
    decision: "La décision vous appartient.",
    f1: (nom, s, c, vj, v5, v1) => `**${nom} (${s})** : cours ${c} (${vj} sur la séance, ${v5} sur 5 séances, ${v1} sur 1 an).`,
    f52: (h, b, e) => `Plus haut / plus bas 52 sem. : ${h} / ${b} (à ${e} du plus bas)`,
    ftech: (r, m5, m2) => `RSI 14 : ${r} ; moyenne 50 j : ${m5} ; moyenne 200 j : ${m2}`,
    fliq: (c, l) => `Liquidité : ${c} échangés par jour en moyenne (${l ? "liquide" : "peu liquide"})`,
    fsig: "Signaux :", fregles: "Règles actives :", fzone: z => z ? "Dans la zone d'achat de votre méthode aujourd'hui." : "Hors zone d'achat de votre méthode aujourd'hui.",
    sansIA: "Pour poser vos propres questions, ajoutez la clé gratuite Gemini dans ⚙️ Réglages.",
    secours: "L'IA ne répond pas pour le moment : voici le calcul de l'application."
  },
  ar: {
    seance: d => `**حصة ${d}**`, hb: (h, b, s) => `${h} سهم في ارتفاع، ${b} في انخفاض، ${s} مستقر.`,
    cap: (c, v) => `الرسملة الإجمالية: **${c} مليار درهم** (${v} في الحصة).`,
    baisses: "أكبر الانخفاضات (أسهم سائلة):", hausses: "أكبر الارتفاعات (أسهم سائلة):",
    zone: (n, k) => `منطقة الشراء حسب طريقتك: **${n}** سهم سائل، منها **${k}** بنتيجة صافية متوسطة إيجابية على ~3 سنوات.`,
    pfVide: "لا توجد أسهم محفوظة. أضف مشترياتك في تبويب المحفظة لأتمكن من مراقبتها.",
    pfTot: (v, c, n, p) => `القيمة إذا بعت كل شيء: **${v}** مقابل كلفة ${c}: النتيجة الصافية **${n}** (${p})، مع العمولات.`,
    pfLigne: (nom, q, pr, c, vj, n, p) => `**${nom}**: ${q} × ${pr}، السعر ${c} (${vj}) ← صافي ${n} (${p})`,
    pfAl: "للمراقبة:", pfRien: "لا تنبيهات اليوم على أسهمك.",
    strat: (o, s, d) => `طريقتك: البيع عند ‎+${o}%‎، الخروج عند ‎-${s}%‎، خلال ${d} حصص كحد أقصى. النتائج على ~3 سنوات مع العمولات:`,
    stratZ: (n, k, m) => `- ${n} سهم سائل في منطقة الشراء اليوم؛ ${k} منها بنتيجة صافية متوسطة إيجابية. المتوسط: **${m}** لكل عملية.`,
    stratAll: (n, k, m) => `- على مجموع ${n} سهم سائل تم اختبارها: ${k} إيجابية، المتوسط **${m}** لكل عملية.`,
    stratTop: "أفضل النتائج في منطقة الشراء:",
    frais: (a, z) => `عمولات الذهاب والإياب ≈ **${a}**: يلزم ارتفاع **‎+${z}‎** على الأقل لتفادي الخسارة.`,
    stratKo: "الخلاصة بالأرقام: الطريقة تخسر في المتوسط بعد العمولات حاليا. استهداف ربح أعلى من العمولات أو انتقاء أدق يغير النتيجة؛ جرّب إعدادات أخرى في ⚙️.",
    stratOk: "الخلاصة بالأرقام: الطريقة تربح في المتوسط بعد العمولات على هذه الأسهم، دون ضمان للمستقبل.",
    bTitre: "أكبر انخفاضات الحصة (أسهم سائلة):",
    bLigne: (nom, v, c, e, r) => `**${nom}**: ${v}، السعر ${c}، على بعد ${e} من أدنى مستوى في 52 أسبوعا، RSI ${r}`,
    ordA: (q, nom, p, m) => `**شراء ${q} من ${nom} بسعر ${p}** (المبلغ ${m})`,
    ordV: (q, nom, p, m) => `**بيع ${q} من ${nom} بسعر ${p}** (المبلغ ${m})`,
    ecart: (e, c) => `الفرق مع آخر سعر (${c}): ${e}`,
    fa: (f, t) => `عمولة الشراء: ${f}؛ الكلفة الإجمالية: ${t}`,
    pr: (p, z) => `أدنى سعر بيع دون خسارة: **${p}** (${z})`,
    obj: (o, p, g) => `عند الهدف (‎+${o}%‎، ${p}): ربح صاف **${g}**`,
    sor: (s, p, g) => `عند الخروج (‎-${s}%‎، ${p}): خسارة صافية **${g}**`,
    poids: (p, l) => `الوزن في رأس مالك: ${p} (المبلغ المقرر لكل سهم: ${l})`,
    hist: (n, a, m) => `طريقتك على هذا السهم (~3 سنوات): ${n} عملية، بلوغ الهدف ${a}، المتوسط الصافي **${m}**`,
    fv: (f, n) => `عمولة البيع: ${f}؛ تتوصل صافيا بـ: ${n}`,
    pos: (q, pm, r) => `الأسهم المملوكة: ${q} بمتوسط ${pm}؛ النتيجة الصافية لهذا البيع: **${r}**`,
    att: "**نقاط الانتباه:**", rienAtt: "لا تنبيهات تلقائية.",
    decision: "القرار لك.",
    f1: (nom, s, c, vj, v5, v1) => `**${nom} (${s})**: السعر ${c} (${vj} في الحصة، ${v5} في 5 حصص، ${v1} في سنة).`,
    f52: (h, b, e) => `أعلى / أدنى مستوى في 52 أسبوعا: ${h} / ${b} (على بعد ${e} من الأدنى)`,
    ftech: (r, m5, m2) => `RSI 14: ${r}؛ متوسط 50 يوما: ${m5}؛ متوسط 200 يوم: ${m2}`,
    fliq: (c, l) => `السيولة: ${c} يوميا في المتوسط (${l ? "سائل" : "ضعيف السيولة"})`,
    fsig: "الإشارات:", fregles: "القواعد النشطة:", fzone: z => z ? "داخل منطقة الشراء حسب طريقتك اليوم." : "خارج منطقة الشراء حسب طريقتك اليوم.",
    sansIA: "لطرح أسئلتك الخاصة، أضف مفتاح Gemini المجاني في ⚙️ الإعدادات.",
    secours: "الذكاء الاصطناعي لا يجيب حاليا: هذا حساب التطبيق."
  }
};
const l = (k, ...a) => { const v = (L[LANG] || L.fr)[k]; return typeof v === "function" ? v(...a) : v; };
const li = s => "- " + s;
const nett = s => String(s).replace(/[⁦-⁩]/g, "");

const LOCAL = {
  marche() {
    const r = executer("marche_du_jour", {}), m = r.marche, liq = V.filter(f => f.liquide && f.a_jour && f.var_jour != null).sort((a, b) => a.var_jour - b.var_jour);
    const z = r.zone_achat_liquides || [], k = z.filter(v => (v.strategie?.resultat_net_moyen_pct ?? -1) > 0).length;
    return [l("seance", String(m.date_seance).split("-").reverse().join("/")), l("hb", m.nb_hausse, m.nb_baisse, m.nb_stable), m.masi != null ? l("cap", f2(m.masi), sg(m.masi_var)) : "",
      "", l("baisses"), ...liq.slice(0, 5).map(f => li(`${f.nom} : ${sg(f.var_jour)}`)),
      "", l("hausses"), ...liq.slice(-5).reverse().map(f => li(`${f.nom} : ${sg(f.var_jour)}`)),
      "", l("zone", z.length, k)].join("\n");
  },
  portefeuille() {
    const r = executer("mon_portefeuille", {});
    if (r.vide) return l("pfVide");
    const ps = r.positions, cout = ps.reduce((a, p) => a + p.quantite * p.prix_achat * (1 + tauxFrais().fa), 0);
    const nn = ps.reduce((a, p) => a + (p.resultat_net_mad ?? 0), 0);
    const al = typeof alertesPortefeuille === "function" ? alertesPortefeuille() : [];
    return [l("pfTot", mad2(cout + nn), mad2(cout), mad2(nn), sg(cout ? nn / cout * 100 : null)), "",
      ...ps.map(p => li(l("pfLigne", p.nom, f2(p.quantite, 0), f2(p.prix_achat), f2(p.cours), sg(p.var_jour_pct), mad2(p.resultat_net_mad), sg(p.resultat_net_pct)))), "",
      al.length ? l("pfAl") : l("pfRien"), ...al.map(a => li(`${a.titre} : ${nett(a.txt)}`))].join("\n");
  },
  strategie() {
    const liq = V.filter(f => f.liquide), g = liq.map(f => ({f, s: grille(f)})).filter(x => x.s && x.s.executes >= 10 && x.s.resultat_net_moyen_pct != null);
    const z = g.filter(x => x.f.strategie?.zone), moy = a => a.length ? a.reduce((t, x) => t + x.s.resultat_net_moyen_pct, 0) / a.length : null;
    const {fa, fv} = tauxFrais(), ar = ((1 + fa) / (1 - fv) - 1) * 100;
    const mz = moy(z), mg = moy(g), top = [...z].sort((a, b) => b.s.resultat_net_moyen_pct - a.s.resultat_net_moyen_pct).slice(0, 3);
    return [l("strat", R.obj, R.seuil, R.duree),
      l("stratZ", z.length, z.filter(x => x.s.resultat_net_moyen_pct > 0).length, sg(mz)),
      l("stratAll", g.length, g.filter(x => x.s.resultat_net_moyen_pct > 0).length, sg(mg)),
      ...(top.length ? ["", l("stratTop"), ...top.map(x => li(`${x.f.nom} : ${sg(x.s.resultat_net_moyen_pct)} (${x.s.executes} ${AR() ? "عملية" : "op."}, ${f2(x.s.pct_objectif_atteint, 0)} %)`))] : []),
      "", l("frais", f2(ar) + " %", f2(ar) + " %"), "", (mg ?? -1) > 0 ? l("stratOk") : l("stratKo")].join("\n");
  },
  baisses() {
    const r = executer("lister_valeurs", {filtre: "baisse", liquides_seulement: true, limite: 8});
    return [l("bTitre"), ...r.map(v => li(l("bLigne", v.nom, sg(v.var_jour_pct), f2(v.cours), sg(v.ecart_plus_bas_52s_pct), f2(v.rsi14, 0))))].join("\n");
  },
  ordre(a) {
    const r = executer("verifier_ordre", a);
    if (r.introuvable || r.erreur) return String(r.introuvable || r.erreur);
    const nom = r.valeur.split(" ").slice(1).join(" "), out = [];
    if (r.sens === "achat") {
      out.push(l("ordA", f2(r.quantite, 0), nom, mad2(r.prix, 2), mad2(r.montant_mad)), "",
        li(l("ecart", sg(r.ecart_dernier_cours_pct), mad2(r.dernier_cours, 2))), li(l("fa", mad2(r.frais_achat_mad, 2), mad2(r.cout_total_mad))),
        li(l("pr", mad2(r.prix_revente_minimum_sans_perte, 2), sg(r.hausse_minimum_sans_perte_pct))),
        li(l("obj", r.objectif.pct, mad2(r.objectif.prix, 2), mad2(r.objectif.gain_net_mad))), li(l("sor", r.sortie.pct, mad2(r.sortie.prix, 2), mad2(r.sortie.perte_nette_mad))),
        li(l("poids", f2(r.poids_capital_pct, 1) + " %", mad2(r.montant_prevu_par_ligne_mad))));
      const h = r.historique_strategie;
      if (h && h.executes) out.push(li(l("hist", h.executes, f2(h.pct_objectif_atteint, 0) + " %", sg(h.resultat_net_moyen_pct))));
    } else {
      out.push(l("ordV", f2(r.quantite, 0), nom, mad2(r.prix, 2), mad2(r.montant_mad)), "",
        li(l("ecart", sg(r.ecart_dernier_cours_pct), mad2(r.dernier_cours, 2))), li(l("fv", mad2(r.frais_vente_mad, 2), mad2(r.produit_net_mad))));
      if (r.position) out.push(li(l("pos", f2(r.position.quantite, 0), mad2(r.position.prix_moyen, 2), mad2(r.position.resultat_net_vente_mad))));
    }
    out.push("", l("att"), ...(r.alertes_automatiques.length ? r.alertes_automatiques.map(li) : [li(l("rienAtt"))]), "", l("decision"));
    return out.join("\n");
  },
  fiche(a) {
    const r = executer("chercher_valeur", a);
    if (r.introuvable) return String(r.introuvable);
    const out = [l("f1", r.nom, r.symbole, mad2(r.cours, 2), sg(r.var_jour_pct), sg(r.var_5j_pct), sg(r.var_1an_pct)), "",
      li(l("f52", f2(r.plus_haut_52s), f2(r.plus_bas_52s), sg(r.ecart_plus_bas_52s_pct))), li(l("ftech", f2(r.rsi14, 0), f2(r.mm50), f2(r.mm200))),
      li(l("fliq", mad2(r.capitaux_moyens_jour_mad), r.liquide)), li(l("fzone", r.dans_zone_achat))];
    const h = r.strategie_utilisateur;
    if (h && h.executes) out.push(li(l("hist", h.executes, f2(h.pct_objectif_atteint, 0) + " %", sg(h.resultat_net_moyen_pct))));
    if (r.signaux?.length) out.push("", l("fsig"), ...r.signaux.map(li));
    if (r.regles_actives?.length) out.push("", l("fregles"), ...r.regles_actives.map(x => li(`${x.nom} (${x.sens})`)));
    return out.join("\n");
  }
};
const CHIPS_LOCAUX = ["marche", "portefeuille", "strategie", "baisses"];
function calculLocal(spec) { try { return LOCAL[spec.type](spec.args || {}); } catch (e) { return null; } }

/* ---------- Consignes ---------- */
function consignes() {
  const langue = LANG === "ar" ? "en arabe (arabe standard simple, compréhensible au Maroc)" : "en français";
  return `Tu es le « Conseiller IA » de l'application BVC Matin (Bourse de Casablanca). Tu aides un particulier marocain qui fait de l'achat-revente à court terme : acheter des valeurs liquides près de leurs plus bas et revendre vers +${R.obj} %. Sa femme utilise aussi l'application.

Règles absolues :
- Réponds ${langue}, sauf si l'utilisateur écrit dans l'autre langue : suis alors sa langue.
- Chaque chiffre vient des outils (marche_du_jour, chercher_valeur, lister_valeurs, verifier_ordre, mon_portefeuille). N'invente jamais un cours, un volume ou une statistique. Si une donnée manque, dis-le.
- Les données datent de la séance du ${M.date_seance} (cours différés). Nous sommes le ${new Date().toLocaleDateString("fr-FR")}.
- Tu n'es pas un conseiller financier agréé. Donne des faits, des calculs, des risques et les arguments pour et contre ; ne donne jamais d'ordre du type « achetez » ou « vendez ». Termine toute vérification d'ordre en rappelant que la décision lui appartient.
- Tu ne passes aucun ordre et ne demandes jamais d'identifiants.
- Pour tout achat ou vente précis, appelle verifier_ordre et commente ses alertes_automatiques une par une.
- Sois honnête quand les statistiques sont défavorables (résultat net moyen négatif après frais, par exemple), même si l'utilisateur espère l'inverse. Le passé ne garantit pas l'avenir : dis-le une fois, sans insister.

Style : court et lisible sur téléphone. Phrases simples, listes « - », **gras** pour les chiffres clés, pas de tableau. Montants en MAD.

Réglages : capital ${R.capital} MAD sur ${R.lignes} lignes au plus, courtage ${R.courtage} % HT (+ TVA 20 %), taxe ${R.taxe} % à la vente, objectif +${R.obj} %, sortie -${R.seuil} %, durée max ${R.duree} séances. Portefeuille : ${PF.length} ligne(s).`;
}

/* ---------- Appels aux API ---------- */
class ErrIA extends Error { constructor(type, msg) { super(msg || type); this.type = type; } }
async function appel(url, init, delaiMs = 45000) {
  let r;
  const ac = new AbortController(), minuteur = setTimeout(() => ac.abort(), delaiMs);
  try { r = await fetch(url, {...init, signal: ac.signal}); }
  catch (e) { throw new ErrIA(ac.signal.aborted ? "delai" : "reseau", ac.signal.aborted ? "délai dépassé" : "réseau"); }
  finally { clearTimeout(minuteur); }
  let j = null; try { j = await r.json(); } catch (e) {}
  if (r.ok) return j;
  const m = j?.error?.message || ("HTTP " + r.status);
  if (r.status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(m)) throw new ErrIA("quota", m);
  if (r.status === 401 || r.status === 403 || /API key|api_key|authentication|permission/i.test(m)) throw new ErrIA("cle", m);
  if (/credit balance|billing/i.test(m)) throw new ErrIA("credit", m);
  if (r.status === 404) throw new ErrIA("modele", m);
  throw new ErrIA("autre", m);
}

// Gemini : on choisit automatiquement le meilleur modèle « flash » disponible pour la clé.
async function modeleGemini(forcer) {
  const cache = st.get("gmodele", null);
  if (cache && !forcer && cache.cle === CLES.gemini.slice(-6)) return cache.nom;
  const j = await appel("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {headers: {"x-goog-api-key": CLES.gemini}});
  const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const ok = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map(m => m.name.replace(/^models\//, ""))
    .filter(n => /^gemini-[\d.]+-flash/.test(n) && !/lite|image|tts|live|audio|thinking|robotics|exp/.test(n));
  const stable = ok.filter(n => !/preview/.test(n));
  const choix = (stable.length ? stable : ok).sort((a, b) => ver(b) - ver(a) || a.length - b.length)[0] || "gemini-2.5-flash";
  st.set("gmodele", {nom: choix, cle: CLES.gemini.slice(-6)});
  return choix;
}
const schemaGemini = OUTILS.map(o => o.params ? {name: o.name, description: o.description, parameters: o.params} : {name: o.name, description: o.description});

/* Réflexion courte : les modèles récents « réfléchissent » longtemps par défaut,
   ce qui rend les réponses lentes et peut épuiser la limite de texte avant la réponse. */
function reflexionCourte(modele) {
  if (st.get("gsansreflexion", false)) return undefined;
  return /gemini-2\./.test(modele) ? {thinkingBudget: 0} : {thinkingLevel: "low"};
}
async function genererGemini(modele, contents, avecOutils) {
  const gc = {temperature: 0.3, maxOutputTokens: 8192};
  const rf = reflexionCourte(modele); if (rf) gc.thinkingConfig = rf;
  const corps = {systemInstruction: {parts: [{text: consignes()}]}, contents, generationConfig: gc};
  if (avecOutils) corps.tools = [{functionDeclarations: schemaGemini}];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`;
  const init = b => ({method: "POST", headers: {"Content-Type": "application/json", "x-goog-api-key": CLES.gemini}, body: JSON.stringify(b)});
  try { return await appel(url, init(corps)); }
  catch (e) {
    if (rf && e.type === "autre" && /think/i.test(e.message)) {     // ce modèle refuse le réglage : on le retire
      st.set("gsansreflexion", true); delete gc.thinkingConfig; return await appel(url, init(corps));
    }
    throw e;
  }
}
const texteGemini = c => (c?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join("").trim();
async function viaGemini(hist, surOutil) {
  let modele = await modeleGemini(false);
  const contents = hist.map(m => ({role: m.role === "assistant" ? "model" : "user", parts: [{text: m.content}]}));
  for (let tour = 0; tour < 6; tour++) {
    let j;
    try { j = await genererGemini(modele, contents, true); }
    catch (e) {
      if (e.type === "modele" && tour === 0) { modele = await modeleGemini(true); tour--; continue; }
      throw e;
    }
    const cand = j?.candidates?.[0], c = cand?.content;
    if (!c || !c.parts) throw new ErrIA("vide", j?.promptFeedback?.blockReason || cand?.finishReason || "réponse vide");
    contents.push(c);
    const appels = c.parts.filter(p => p.functionCall);
    if (!appels.length) {
      const t = texteGemini(c);
      if (t) return t;
      // Réponse vide (réflexion trop longue, texte coupé) : on redemande une réponse directe, sans outil.
      contents.push({role: "user", parts: [{text: LANG === "ar" ? "أجب الآن مباشرة وباختصار، دون استدعاء أي أداة." : "Réponds maintenant directement et brièvement, sans appeler d'outil."}]});
      const j2 = await genererGemini(modele, contents, false);
      const t2 = texteGemini(j2?.candidates?.[0]?.content);
      if (t2) return t2;
      throw new ErrIA("vide", j2?.candidates?.[0]?.finishReason || "réponse vide");
    }
    const reponses = appels.map(p => {
      surOutil(p.functionCall.name);
      const fr = {name: p.functionCall.name, response: {resultat: executer(p.functionCall.name, p.functionCall.args)}};
      if (p.functionCall.id) fr.id = p.functionCall.id;
      return {functionResponse: fr};
    });
    contents.push({role: "user", parts: reponses});
  }
  throw new ErrIA("autre", "trop d'étapes");
}

const MODELE_CLAUDE = "claude-sonnet-5-5";
const schemaClaude = OUTILS.map(o => ({name: o.name, description: o.description, input_schema: o.params || {type: "object", properties: {}}}));
async function viaClaude(hist, surOutil) {
  const messages = hist.map(m => ({role: m.role, content: m.content}));
  for (let tour = 0; tour < 7; tour++) {
    const j = await appel("https://api.anthropic.com/v1/messages", {method: "POST",
      headers: {"Content-Type": "application/json", "x-api-key": CLES.anthropic, "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"},
      body: JSON.stringify({model: MODELE_CLAUDE, max_tokens: 1600, temperature: 0.3, system: consignes(), tools: schemaClaude, messages})});
    messages.push({role: "assistant", content: j.content});
    const outils = (j.content || []).filter(b => b.type === "tool_use");
    if (j.stop_reason !== "tool_use" || !outils.length) return (j.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    messages.push({role: "user", content: outils.map(b => { surOutil(b.name);
      return {type: "tool_result", tool_use_id: b.id, content: JSON.stringify(executer(b.name, b.input))}; })});
  }
  throw new ErrIA("autre", "trop d'étapes");
}

/* Choix du fournisseur : gratuit d'abord, Claude en relais. */
async function repondre(hist, surOutil) {
  const g = !!CLES.gemini, a = !!CLES.anthropic;
  if (MODE === "anthropic" && a) return {texte: await viaClaude(hist, surOutil), par: "claude"};
  if (MODE === "gemini" || (MODE === "auto" && g)) {
    if (!g) throw new ErrIA("sanscle");
    try { return {texte: await viaGemini(hist, surOutil), par: "gemini"}; }
    catch (e) {
      if (MODE === "auto" && a && (e.type === "quota" || e.type === "reseau" || e.type === "modele" || e.type === "delai" || e.type === "vide")) return {texte: await viaClaude(hist, surOutil), par: "claude", bascule: true};
      if (e.type === "quota" && !a) throw new ErrIA("quotaSansClaude");
      throw Object.assign(e, {fournisseur: "Gemini"});
    }
  }
  if (a) return {texte: await viaClaude(hist, surOutil), par: "claude"};
  throw new ErrIA("sanscle");
}


/* ---------- Interface : onglet « IA » de l'application ---------- */
const css = `
#v-ia{position:fixed;left:0;right:0;top:calc(var(--hh) + env(safe-area-inset-top));bottom:calc(var(--nav) + env(safe-area-inset-bottom));z-index:5;display:flex;flex-direction:column;background:var(--bg)}
.ia-fil{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:14px max(16px,env(safe-area-inset-right)) 8px max(16px,env(safe-area-inset-left))}
.ia-fil>.in{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
.ia-m{max-width:92%;padding:11px 14px;border-radius:16px;background:var(--surface);border:1px solid var(--line);overflow-wrap:anywhere;min-width:0;line-height:1.5;font-size:15px}
.ia-m.u{align-self:flex-end;background:var(--accent);color:var(--accent-ink);border-color:transparent;white-space:pre-wrap}
.ia-m p{margin:0 0 7px}.ia-m p:last-child{margin:0}.ia-m ul{margin:3px 0 7px;padding-inline-start:20px}.ia-m h4{margin:8px 0 3px;font-size:15px}
.ia-m .par{display:block;margin-top:6px;font-size:11px;color:var(--muted)}
.ia-m .att{color:var(--muted);font-style:italic}
.ia-m.err{border-color:var(--down);color:var(--down)}
.ia-note{font-size:12.5px;color:var(--muted);border-inline-start:3px solid var(--warn);padding-inline-start:9px;margin-top:8px}
.ia-bas{padding:8px max(16px,env(safe-area-inset-right)) 10px max(16px,env(safe-area-inset-left));background:var(--bg);border-top:1px solid var(--line)}
.ia-bas>.in{max-width:720px;margin:0 auto}
.ia-chips{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;padding-bottom:8px}.ia-chips::-webkit-scrollbar{display:none}
.ia-chip{flex:none;min-height:38px;border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:999px;padding:7px 13px;font-size:14px;white-space:nowrap;cursor:pointer}
.ia-chip.k{font-weight:700;border-color:var(--accent);color:var(--accent)}
.ia-comp{display:flex;gap:8px;align-items:flex-end;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:5px}
.ia-comp textarea{flex:1;min-width:0;border:0;background:transparent;color:var(--text);font:inherit;font-size:16px;resize:none;max-height:130px;padding:9px 10px;outline:none}
.ia-env{flex:none;width:44px;height:44px;border:0;border-radius:12px;background:var(--accent);color:var(--accent-ink);font-size:18px;cursor:pointer}
.ia-env:disabled{opacity:.4}
[dir=rtl] .ia-env{transform:scaleX(-1)}
.ia-pan{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0}
.ia-pan h3{margin:0;font-size:17px}.ia-pan p{margin:0;font-size:13px;color:var(--muted);line-height:1.45}
.ia-pan label{display:flex;flex-direction:column;gap:4px;font-size:14px;color:var(--text);font-weight:600;min-width:0;margin:6px 0 0}
.ia-2{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}.ia-2>*{min-width:0}
.ia-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.ia-ok{color:var(--up)!important}.ia-ko{color:var(--down)!important}
.ia-etat{display:flex;justify-content:space-between;gap:8px;font-size:14px;padding:6px 0;border-bottom:1px dashed var(--line)}
`;
const st1 = document.createElement("style"); st1.textContent = css; document.head.appendChild(st1);
const vue = document.getElementById("v-ia");
vue.innerHTML = `<div class="ia-fil" id="ia-fil"><div class="in" id="ia-in-fil" aria-live="polite"></div></div>
  <div class="ia-bas"><div class="in"><div class="ia-chips" id="ia-chips"></div>
    <form class="ia-comp" id="ia-form"><textarea id="ia-in" rows="1" autocomplete="off"></textarea><button class="ia-env" id="ia-env" type="submit" aria-label="Envoyer">➤</button></form></div></div>`;
const $i = s => document.getElementById(s);
const echap = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

function md(s) {
  let html = "", liste = false;
  const inl = v => v.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<i>$2</i>");
  for (const l of echap(s).split("\n")) {
    const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/);
    if (m) { if (!liste) { html += "<ul>"; liste = true; } html += `<li>${inl(m[1])}</li>`; continue; }
    if (liste) { html += "</ul>"; liste = false; }
    const h = l.match(/^#{1,4}\s+(.*)/);
    if (h) html += `<h4>${inl(h[1])}</h4>`; else if (l.trim()) html += `<p>${inl(l)}</p>`;
  }
  return html + (liste ? "</ul>" : "");
}
const fil = () => $i("ia-in-fil");
function bulle(role, html, cls = "") {
  const d = document.createElement("div");
  d.className = `ia-m ${role === "user" ? "u" : ""} ${cls}`; d.innerHTML = html;
  fil().appendChild(d); return d;
}
const enBas = () => { const f = $i("ia-fil"); f.scrollTop = f.scrollHeight; };
const etiquette = par => `<span class="par">${par === "claude" ? x("parClaude") : par === "app" ? (LANG === "ar" ? "حساب التطبيق · بدون ذكاء اصطناعي" : "Calcul de l'application · sans IA") : x("parGemini")}</span>`;
const configure = () => !!(CLES.gemini || CLES.anthropic);

function rendre() {
  vue.lang = LANG;
  $i("ia-in").placeholder = x("ph"); $i("ia-env").disabled = busy;
  fil().innerHTML = "";
  bulle("ai", `<p>${x("bienvenue")}</p><div class="ia-note">${x("avert")}</div>`);
  if (!configure()) panneauAccueil();
  FIL.forEach(m => bulle(m.role, m.role === "user" ? echap(m.content) : md(m.content) + etiquette(m.par)));
  $i("ia-chips").innerHTML = `<button class="ia-chip k" type="button" data-ordre="1">${x("chipOrdre")}</button>`
    + x("chips").map((c, i) => `<button class="ia-chip" type="button" data-i="${i}">${echap(c)}</button>`).join("")
    + (FIL.length ? `<button class="ia-chip" type="button" data-raz="1">${x("raz")}</button>` : "");
  enBas();
}
let rendu = false;
function afficher() { if (!rendu) { rendre(); rendu = true; } enBas(); }

function repLocale(texte, local, note) {
  const txt = calculLocal(local);
  if (!txt) return false;
  FIL.push({role: "user", content: texte});
  bulle("user", echap(texte));
  bulle("ai", (note ? `<p class="ia-note">${echap(note)}</p>` : "") + md(txt) + etiquette("app"));
  FIL.push({role: "assistant", content: txt, par: "app"}); st.set("fil", FIL.slice(-30));
  rendreChipsRaz(); enBas(); return true;
}
async function demander(texte, local = null) {
  texte = (texte || "").trim();
  if (!texte || busy) return;
  if (!configure()) {
    if (local && repLocale(texte, local)) { bulle("ai", `<p class="ia-note">${echap(l("sansIA"))}</p>`); enBas(); return; }
    bulle("user", echap(texte)); bulle("ai", `<p>${echap(x("sansCle"))}</p>`);
    $i("ia-onb")?.remove(); panneauAccueil(); return;
  }
  busy = true; $i("ia-env").disabled = true;
  FIL.push({role: "user", content: texte}); st.set("fil", FIL.slice(-30));
  bulle("user", echap(texte));
  const rep = bulle("ai", `<span class="att">${x("reflexion")}</span>`); enBas();
  const lab = n => (OUTILS.find(o => o.name === n)?.label?.[LANG]) || n;
  let etat = x("reflexion"); const t0 = Date.now();
  const maj = () => { rep.innerHTML = `<span class="att">${echap(etat)} <span class="num">${Math.round((Date.now() - t0) / 1000)} s</span></span>`; };
  const chrono = setInterval(maj, 1000);
  try {
    const r = await repondre(FIL.slice(-14), n => { etat = x("outil", lab(n)); maj(); enBas(); });
    const txt = r.texte || "…";
    rep.innerHTML = (r.bascule ? `<p class="ia-note">${x("bascule")}</p>` : "") + md(txt) + etiquette(r.par);
    FIL.push({role: "assistant", content: txt, par: r.par}); st.set("fil", FIL.slice(-30));
    if (!$i("ia-in-fil").querySelector(".ia-chip[data-raz]")) rendreChipsRaz();
  } catch (e) {
    FIL.pop(); st.set("fil", FIL.slice(-30));
    rep.classList.add("err");
    const fz = e.fournisseur || (MODE === "anthropic" || !CLES.gemini ? "Claude" : "Gemini");
    const m = {sanscle: x("sansCle"), quotaSansClaude: x("quotaSansClaude"), cle: x("cleKo", fz), credit: x("creditKo"), reseau: x("reseau"),
      quota: x("erreur", "quota"),
      delai: LANG === "ar" ? "لم يجب Gemini في الوقت المناسب. أعد المحاولة أو اطرح سؤالا أقصر." : "Gemini n'a pas répondu à temps. Réessayez ou posez une question plus courte.",
      vide: LANG === "ar" ? "أعاد Gemini جوابا فارغا. أعد المحاولة." : "Gemini a renvoyé une réponse vide. Réessayez."}[e.type] || x("erreur", e.message);
    if (local && e.type !== "sanscle") {
      const txt = calculLocal(local);
      if (txt) { rep.classList.remove("err"); rep.innerHTML = `<p class="ia-note">${echap(l("secours"))} (${echap(m)})</p>` + md(txt) + etiquette("app");
        FIL.push({role: "user", content: texte}, {role: "assistant", content: txt, par: "app"}); st.set("fil", FIL.slice(-30)); return; }
    }
    rep.innerHTML = `<p>${echap(m)}</p><p class="ia-note">${x("gerer")}</p>`;
    if (e.type === "sanscle") panneauAccueil();
  } finally { clearInterval(chrono); busy = false; $i("ia-env").disabled = false; enBas(); }
}
function rendreChipsRaz() {
  if (!$i("ia-chips").querySelector("[data-raz]")) $i("ia-chips").insertAdjacentHTML("beforeend", `<button class="ia-chip" type="button" data-raz="1">${x("raz")}</button>`);
}

/* Test des clés : renvoie une liste de {ok, txt}. */
async function tester() {
  const res = [];
  if (CLES.gemini) {
    try {
      st.del("gsansreflexion");
      const m = await modeleGemini(true), t0 = Date.now();
      const j = await genererGemini(m, [{role: "user", parts: [{text: "Réponds seulement : OK"}]}], false);
      const t = texteGemini(j?.candidates?.[0]?.content);
      if (!t) throw new ErrIA("vide", j?.candidates?.[0]?.finishReason || "réponse vide");
      res.push({ok: true, txt: x("testOk", `Gemini (${m}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`)});
    } catch (e) { res.push({ok: false, txt: x("testKo", "Gemini", (e.type ? e.type + " · " : "") + e.message.slice(0, 160))}); }
  }
  if (CLES.anthropic) {
    try { await appel("https://api.anthropic.com/v1/messages", {method: "POST", headers: {"Content-Type": "application/json", "x-api-key": CLES.anthropic,
      "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true"},
      body: JSON.stringify({model: MODELE_CLAUDE, max_tokens: 5, messages: [{role: "user", content: "ok"}]})}); res.push({ok: true, txt: x("testOk", "Claude")}); }
    catch (e) { res.push({ok: false, txt: x("testKo", "Claude", e.message.slice(0, 120))}); }
  }
  return res;
}
const champCle = (id, ph) => `<input id="${id}" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${ph}">`;

/* Carte d'accueil (aucune clé) : 2 étapes, un seul bouton. */
function panneauAccueil() {
  if ($i("ia-onb")) return $i("ia-onb").scrollIntoView({block: "nearest"});
  const d = document.createElement("div"); d.className = "ia-pan"; d.id = "ia-onb";
  d.innerHTML = `<h3>${x("onbTitre")}</h3>
    <label for="onb-g">${x("onb1")}</label>
    <p>${x("onb1Aide")} <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></p>
    ${champCle("onb-g", "AIza…")}
    <label for="onb-a">${x("onb2")}</label>
    <p>${x("onb2Aide")}</p>
    ${champCle("onb-a", "sk-ant-…")}
    <div class="ia-acts"><button class="btn primary" id="onb-go" type="button">${x("onbGo")}</button></div>
    <p id="onb-msg"></p>`;
  fil().appendChild(d); enBas();
  $i("onb-go").onclick = async () => {
    const g = $i("onb-g").value.trim(), a = $i("onb-a").value.trim(), msg = $i("onb-msg");
    if (!g && !a) { msg.className = "ia-ko"; msg.textContent = x("sansCle"); return; }
    if (g) { CLES.gemini = g; st.del("gmodele"); }
    if (a) CLES.anthropic = a;
    st.set("cles", CLES);
    msg.className = ""; msg.textContent = x("testEnCours");
    const res = await tester();
    msg.className = res.every(r => r.ok) ? "ia-ok" : "ia-ko";
    msg.textContent = res.map(r => r.txt).join(" · ");
    if (res.some(r => r.ok)) setTimeout(rendre, 1200);
  };
}

/* Gestion complète des clés, affichée dans Réglages. */
function cles(box) {
  if (!box) return;
  box.innerHTML = `<div class="ia-pan" style="border:0;padding:0">
    <p>${x("rgAide")}</p>
    <div class="ia-etat"><span>Gemini</span><b class="${CLES.gemini ? "ia-ok" : ""}">${CLES.gemini ? x("masquee") : x("vide")}</b></div>
    <div class="ia-etat"><span>Claude</span><b class="${CLES.anthropic ? "ia-ok" : ""}">${CLES.anthropic ? x("masquee") : x("vide")}</b></div>
    <label for="rg-g">${x("gTitre")}</label><p>${x("gAide")} <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></p>${champCle("rg-g", "AIza…")}
    <label for="rg-a">${x("aTitre")}</label><p>${x("aAide")} <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a></p>${champCle("rg-a", "sk-ant-…")}
    <label for="rg-mode">${x("mode")}<select id="rg-mode">
      <option value="auto">${x("modeAuto")}</option><option value="gemini">${x("modeG")}</option><option value="anthropic">${x("modeA")}</option></select></label>
    <div class="ia-acts"><button class="btn primary" id="rg-enr" type="button">${x("enr")}</button><button class="btn" id="rg-test" type="button">${x("test")}</button>
      <button class="btn danger" id="rg-eff" type="button">${x("effacer")}</button></div>
    <p id="rg-msg"></p>
    <p><a href="${ARTIFACT}" target="_blank" rel="noopener">${x("claudeai")}</a></p></div>`;
  $i("rg-mode").value = MODE;
  const msg = (t, ok) => { const p = $i("rg-msg"); p.textContent = t; p.className = ok == null ? "" : ok ? "ia-ok" : "ia-ko"; };
  const enr = () => {
    const g = $i("rg-g").value.trim(), a = $i("rg-a").value.trim();
    if (g) { CLES.gemini = g; st.del("gmodele"); }
    if (a) CLES.anthropic = a;
    MODE = $i("rg-mode").value; st.set("cles", CLES); st.set("mode", MODE); rendu = false;
  };
  $i("rg-enr").onclick = () => { enr(); cles(box); $i("rg-msg").textContent = x("ok"); $i("rg-msg").className = "ia-ok"; };
  $i("rg-test").onclick = async () => {
    enr(); msg(x("testEnCours"));
    const res = await tester();
    cles(box); msg(res.map(r => r.txt).join(" · ") || x("sansCle"), res.length > 0 && res.every(r => r.ok));
  };
  $i("rg-eff").onclick = () => { CLES = {gemini: "", anthropic: ""}; st.set("cles", CLES); st.del("gmodele"); rendu = false; cles(box); };
}

function panneauOrdre(isin) {
  $i("ia-ordre")?.remove();
  let sens = "achat";
  const f0 = isin ? PAR_ISIN[isin] : null;
  const d = document.createElement("div"); d.className = "ia-pan"; d.id = "ia-ordre";
  d.innerHTML = `<h3>${x("ordTitre")}</h3>
    <label for="io-val">${x("ordVal")}<select id="io-val">${[...V].sort((a, b) => a.nom.localeCompare(b.nom, "fr")).map(f => `<option value="${echap(f.isin)}"${f0 && f0.isin === f.isin ? " selected" : ""}>${echap(f.nom)}</option>`).join("")}</select></label>
    <div class="seg" role="group"><button type="button" aria-pressed="true" data-s="achat">${x("achat")}</button><button type="button" aria-pressed="false" data-s="vente">${x("vente")}</button></div>
    <div class="ia-2"><label for="io-prix">${x("prix")}<input id="io-prix" type="number" step="0.01" inputmode="decimal"></label>
      <label for="io-qte">${x("qte")}<input id="io-qte" type="number" inputmode="numeric"></label>
      <label for="io-obj">${x("obj")}<input id="io-obj" type="number" step="0.5" inputmode="decimal" value="${R.obj}"></label>
      <label for="io-seuil">${x("seuil")}<input id="io-seuil" type="number" step="0.5" inputmode="decimal" value="${R.seuil}"></label></div>
    <p class="ia-ko" id="io-err" hidden>${x("ordManque")}</p>
    <div class="ia-acts"><button class="btn primary" id="io-go" type="button">${x("ordGo")}</button><button class="btn" id="io-x" type="button">${x("fermer")}</button></div>`;
  fil().appendChild(d); enBas();
  const prixDefaut = () => { const f = PAR_ISIN[$i("io-val").value]; if (f) $i("io-prix").value = f.cours; };
  prixDefaut(); $i("io-val").onchange = prixDefaut;
  d.querySelectorAll(".seg button").forEach(b => b.onclick = () => { sens = b.dataset.s; d.querySelectorAll(".seg button").forEach(y => y.setAttribute("aria-pressed", y === b)); });
  $i("io-x").onclick = () => d.remove();
  $i("io-go").onclick = () => {
    const f = PAR_ISIN[$i("io-val").value], prix = parseFloat(String($i("io-prix").value).replace(",", ".")), qte = parseInt($i("io-qte").value, 10);
    if (!f || !(prix > 0) || !(qte > 0)) { $i("io-err").hidden = false; return; }
    const obj = +($i("io-obj").value || R.obj), seuil = +($i("io-seuil").value || R.seuil);
    d.remove();
    demander(x("ordMsg", {sens, qte, val: `${f.nom} (${f.isin})`, prix, obj, seuil}),
      {type: "ordre", args: {valeur: f.isin, sens, prix, quantite: qte, objectif_pct: obj, sortie_pct: seuil}});
  };
}

/* ---------- Événements ---------- */
$i("ia-form").addEventListener("submit", e => { e.preventDefault(); const v = $i("ia-in").value; $i("ia-in").value = ""; taille(); demander(v); });
const taille = () => { const s = $i("ia-in"); s.style.height = "auto"; s.style.height = Math.min(130, s.scrollHeight) + "px"; };
$i("ia-in").addEventListener("input", taille);
$i("ia-in").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && matchMedia("(hover: hover)").matches) { e.preventDefault(); $i("ia-form").requestSubmit(); } });
$i("ia-chips").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.ordre) return panneauOrdre();
  if (b.dataset.raz) { FIL = []; st.set("fil", FIL); return rendre(); }
  demander(b.textContent, b.dataset.i != null ? {type: CHIPS_LOCAUX[+b.dataset.i]} : null);
});

// API utilisée par l'application (onglet IA, fiche d'une valeur, réglages).
window.BVC_IA = {
  afficher,
  ouvrir() { if (typeof montrer === "function") montrer("ia"); },
  analyser(isin) { afficher(); const f = PAR_ISIN[isin]; if (f) demander(x("ficheQ", `${f.nom} (${f.isin})`), {type: "fiche", args: {valeur: f.isin}}); },
  verifier(isin) { afficher(); panneauOrdre(isin); },
  langue() { rendu = false; if (!vue.classList.contains("hidden")) afficher(); },
  cles
};
})();
