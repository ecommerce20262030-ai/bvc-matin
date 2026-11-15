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
    ficheQ: n => `Analyse ${n} pour moi : situation, risques et ce que dit l'historique de ma stratégie.`
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
    ficheQ: n => `حلل لي ${n}: الوضعية، المخاطر، وما يقوله تاريخ استراتيجيتي.`
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
       bilan_regles: D.bilan_reconstitue, non_diagnostiquees: (D.echecs || []).map(e => e.nom)};
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
   run({filtre, liquides_seulement = true, limite = 12}) {
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
async function appel(url, init) {
  let r;
  try { r = await fetch(url, init); } catch (e) { throw new ErrIA("reseau"); }
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

async function viaGemini(hist, surOutil) {
  let modele = await modeleGemini(false);
  const contents = hist.map(m => ({role: m.role === "assistant" ? "model" : "user", parts: [{text: m.content}]}));
  for (let tour = 0; tour < 7; tour++) {
    let j;
    const corps = JSON.stringify({systemInstruction: {parts: [{text: consignes()}]}, contents,
      tools: [{functionDeclarations: schemaGemini}], generationConfig: {temperature: 0.3, maxOutputTokens: 4096}});
    try {
      j = await appel(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
        {method: "POST", headers: {"Content-Type": "application/json", "x-goog-api-key": CLES.gemini}, body: corps});
    } catch (e) {
      if (e.type === "modele" && tour === 0) { modele = await modeleGemini(true); tour--; continue; }
      throw e;
    }
    const c = j?.candidates?.[0]?.content;
    if (!c || !c.parts) throw new ErrIA("autre", j?.promptFeedback?.blockReason || "réponse vide");
    contents.push(c);
    const appels = c.parts.filter(p => p.functionCall);
    if (!appels.length) return c.parts.filter(p => p.text && !p.thought).map(p => p.text).join("").trim();
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
      if (MODE === "auto" && a && (e.type === "quota" || e.type === "reseau" || e.type === "modele")) return {texte: await viaClaude(hist, surOutil), par: "claude", bascule: true};
      if (e.type === "quota" && !a) throw new ErrIA("quotaSansClaude");
      throw Object.assign(e, {fournisseur: "Gemini"});
    }
  }
  if (a) return {texte: await viaClaude(hist, surOutil), par: "claude"};
  throw new ErrIA("sanscle");
}

/* ---------- Interface ---------- */
const css = `
.ia-fab{position:fixed;z-index:21;inset-inline-end:max(16px,env(safe-area-inset-right));bottom:calc(72px + env(safe-area-inset-bottom));
  width:54px;height:54px;border-radius:50%;border:0;background:var(--text);color:var(--bg);font-weight:800;font-size:16px;
  box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:pointer}
.ia{position:fixed;inset:0;z-index:40;background:var(--bg);display:flex;flex-direction:column}
.ia[hidden]{display:none}
.ia-top{display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 10px max(16px,env(safe-area-inset-left));
  background:var(--surface);border-bottom:1px solid var(--line)}
.ia-top b{flex:1;font-size:17px;min-width:0}
.ia-top small{display:block;font-weight:500;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ia-bt{border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:10px;height:36px;padding:0 12px;font-weight:600;font-size:13px;cursor:pointer}
.ia-fil{flex:1;overflow-y:auto;padding:14px max(16px,env(safe-area-inset-right)) 8px max(16px,env(safe-area-inset-left));display:flex;flex-direction:column;gap:10px}
.ia-m{max-width:92%;padding:10px 13px;border-radius:14px;background:var(--surface);border:1px solid var(--line);overflow-wrap:anywhere;min-width:0;line-height:1.45}
.ia-m.u{align-self:flex-end;background:var(--text);color:var(--bg);border-color:transparent;white-space:pre-wrap}
.ia-m p{margin:0 0 7px}.ia-m p:last-child{margin:0}.ia-m ul{margin:3px 0 7px;padding-inline-start:20px}.ia-m h4{margin:8px 0 3px;font-size:14px}
.ia-m .par{display:block;margin-top:6px;font-size:11px;color:var(--muted)}
.ia-m .att{color:var(--muted);font-style:italic}
.ia-m.err{border-color:var(--down);color:var(--down)}
.ia-note{font-size:12.5px;color:var(--muted);border-inline-start:3px solid var(--warn);padding-inline-start:9px;margin-top:8px}
.ia-bas{padding:6px max(16px,env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:var(--bg)}
.ia-chips{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;padding-bottom:8px}.ia-chips::-webkit-scrollbar{display:none}
.ia-chip{flex:none;border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:999px;padding:7px 12px;font-size:13px;white-space:nowrap;cursor:pointer}
.ia-chip.k{font-weight:700;border-color:var(--text)}
.ia-comp{display:flex;gap:8px;align-items:flex-end;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:6px}
.ia-comp textarea{flex:1;min-width:0;border:0;background:transparent;color:var(--text);font:inherit;resize:none;max-height:130px;padding:7px 8px;outline:none}
.ia-env{flex:none;width:40px;height:40px;border:0;border-radius:10px;background:var(--text);color:var(--bg);font-size:18px;cursor:pointer}
.ia-env:disabled{opacity:.4}
.ia-pan{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}
.ia-pan h3{margin:0;font-size:16px}.ia-pan p{margin:0;font-size:13px;color:var(--muted)}
.ia-pan label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);font-weight:600;min-width:0}
.ia-pan input,.ia-pan select{font:inherit;font-size:15px;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:9px 10px;width:100%;min-width:0}
.ia-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ia-acts{display:flex;gap:8px;flex-wrap:wrap}
.ia-ok{color:var(--up)!important}.ia-ko{color:var(--down)!important}
.ia-seg{display:flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.ia-seg button{flex:1;border:0;background:transparent;color:var(--text);padding:9px;font-weight:700;cursor:pointer}
.ia-seg button.on{background:var(--text);color:var(--bg)}
.ia-pan a{color:var(--info)}
`;
const st1 = document.createElement("style"); st1.textContent = css; document.head.appendChild(st1);
const racine = document.createElement("div");
racine.innerHTML = `<button class="ia-fab" id="ia-fab" type="button">IA</button>
<section class="ia" id="ia" hidden role="dialog" aria-modal="true">
  <div class="ia-top"><b><span id="ia-titre"></span><small id="ia-sous"></small></b>
    <button class="ia-bt" id="ia-rg" type="button"></button><button class="ia-bt" id="ia-x" type="button" aria-label="">✕</button></div>
  <div class="ia-fil" id="ia-fil" aria-live="polite"></div>
  <div class="ia-bas"><div class="ia-chips" id="ia-chips"></div>
    <form class="ia-comp" id="ia-form"><textarea id="ia-in" rows="1" autocomplete="off"></textarea><button class="ia-env" id="ia-env" type="submit" aria-label="Envoyer">➤</button></form></div>
</section>`;
document.body.appendChild(racine);
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
function bulle(role, html, cls = "") {
  const d = document.createElement("div");
  d.className = `ia-m ${role === "user" ? "u" : ""} ${cls}`; d.innerHTML = html;
  $i("ia-fil").appendChild(d); return d;
}
const enBas = () => { const f = $i("ia-fil"); f.scrollTop = f.scrollHeight; };
const etiquette = par => `<span class="par">${par === "claude" ? x("parClaude") : x("parGemini")}</span>`;
const configure = () => !!(CLES.gemini || CLES.anthropic);

function rendre() {
  const ia = $i("ia"); ia.dir = LANG === "ar" ? "rtl" : "ltr"; ia.lang = LANG;
  $i("ia-titre").textContent = x("titre");
  $i("ia-sous").textContent = M.date_seance + " · " + (MODE === "anthropic" ? "Claude" : MODE === "gemini" ? "Gemini" : "Gemini → Claude");
  $i("ia-rg").textContent = x("reglages"); $i("ia-x").setAttribute("aria-label", x("fermer"));
  $i("ia-in").placeholder = x("ph"); $i("ia-env").disabled = busy;
  const fil = $i("ia-fil"); fil.innerHTML = "";
  bulle("ai", `<p>${x("bienvenue")}</p><div class="ia-note">${x("avert")}</div>`);
  if (!configure()) { bulle("ai", `<p>${x("sansCle")}</p>`); panneauCles(); }
  FIL.forEach(m => bulle(m.role, m.role === "user" ? echap(m.content) : md(m.content) + etiquette(m.par)));
  $i("ia-chips").innerHTML = `<button class="ia-chip k" type="button" data-ordre="1">${x("chipOrdre")}</button>`
    + x("chips").map(c => `<button class="ia-chip" type="button">${echap(c)}</button>`).join("")
    + (FIL.length ? `<button class="ia-chip" type="button" data-raz="1">${x("raz")}</button>` : "");
  enBas();
}
function ouvrir() { $i("ia").hidden = false; document.body.style.overflow = "hidden"; rendre(); }
function fermerIA() { $i("ia").hidden = true; document.body.style.overflow = ""; }

async function demander(texte) {
  texte = (texte || "").trim();
  if (!texte || busy) return;
  if (!configure()) { panneauCles(); return; }
  busy = true; $i("ia-env").disabled = true;
  FIL.push({role: "user", content: texte}); st.set("fil", FIL.slice(-30));
  bulle("user", echap(texte));
  const rep = bulle("ai", `<span class="att">${x("reflexion")}</span>`); enBas();
  const lab = n => (OUTILS.find(o => o.name === n)?.label?.[LANG]) || n;
  try {
    const r = await repondre(FIL.slice(-14), n => { rep.innerHTML = `<span class="att">${echap(x("outil", lab(n)))}</span>`; enBas(); });
    const txt = r.texte || "…";
    rep.innerHTML = (r.bascule ? `<p class="ia-note">${x("bascule")}</p>` : "") + md(txt) + etiquette(r.par);
    FIL.push({role: "assistant", content: txt, par: r.par}); st.set("fil", FIL.slice(-30));
  } catch (e) {
    FIL.pop(); st.set("fil", FIL.slice(-30));
    rep.classList.add("err");
    const fz = e.fournisseur || (MODE === "anthropic" || !CLES.gemini ? "Claude" : "Gemini");
    const m = {sanscle: x("sansCle"), quotaSansClaude: x("quotaSansClaude"), cle: x("cleKo", fz), credit: x("creditKo"), reseau: x("reseau"),
      quota: x("erreur", "quota")}[e.type] || x("erreur", e.message);
    rep.innerHTML = `<p>${echap(m)}</p>`;
    if (["sanscle", "quotaSansClaude", "cle", "credit"].includes(e.type)) panneauCles();
  } finally { busy = false; $i("ia-env").disabled = false; enBas(); }
}

function panneauCles() {
  if ($i("ia-cles")) return $i("ia-cles").scrollIntoView({block: "nearest"});
  const d = document.createElement("div"); d.className = "ia-pan"; d.id = "ia-cles";
  d.innerHTML = `<h3>${x("rgTitre")}</h3><p>${x("rgAide")}</p>
    <label>${x("gTitre")} · ${CLES.gemini ? x("masquee") : x("vide")}<input id="ia-kg" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="AIza…"></label>
    <p>${x("gAide")} <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></p>
    <label>${x("aTitre")} · ${CLES.anthropic ? x("masquee") : x("vide")}<input id="ia-ka" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-ant-…"></label>
    <p>${x("aAide")} <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a></p>
    <label>${x("mode")}<select id="ia-mode">
      <option value="auto">${x("modeAuto")}</option><option value="gemini">${x("modeG")}</option><option value="anthropic">${x("modeA")}</option></select></label>
    <div class="ia-acts"><button class="ia-bt" id="ia-enr" type="button">${x("enr")}</button><button class="ia-bt" id="ia-test" type="button">${x("test")}</button>
      <button class="ia-bt" id="ia-eff" type="button">${x("effacer")}</button><button class="ia-bt" id="ia-pfx" type="button">${x("fermer")}</button></div>
    <p id="ia-rgmsg"></p>
    <p><a href="${ARTIFACT}" target="_blank" rel="noopener">${x("claudeai")}</a></p>`;
  $i("ia-fil").appendChild(d); enBas();
  $i("ia-mode").value = MODE;
  const msg = (t, ok) => { const p = $i("ia-rgmsg"); p.textContent = t; p.className = ok ? "ia-ok" : "ia-ko"; };
  $i("ia-enr").onclick = () => {
    const g = $i("ia-kg").value.trim(), a = $i("ia-ka").value.trim();
    if (g) { CLES.gemini = g; st.del("gmodele"); }
    if (a) CLES.anthropic = a;
    MODE = $i("ia-mode").value; st.set("cles", CLES); st.set("mode", MODE);
    $i("ia-kg").value = ""; $i("ia-ka").value = ""; msg(x("ok"), true);
    $i("ia-sous").textContent = M.date_seance + " · " + (MODE === "anthropic" ? "Claude" : MODE === "gemini" ? "Gemini" : "Gemini → Claude");
  };
  $i("ia-test").onclick = async () => {
    $i("ia-enr").click();
    const res = [];
    if (CLES.gemini) { try { res.push(x("testOk", "Gemini (" + await modeleGemini(true) + ")")); } catch (e) { res.push(x("testKo", "Gemini", e.message.slice(0, 120))); } }
    if (CLES.anthropic) {
      try { await appel("https://api.anthropic.com/v1/messages", {method: "POST", headers: {"Content-Type": "application/json", "x-api-key": CLES.anthropic,
        "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true"},
        body: JSON.stringify({model: MODELE_CLAUDE, max_tokens: 5, messages: [{role: "user", content: "ok"}]})}); res.push(x("testOk", "Claude")); }
      catch (e) { res.push(x("testKo", "Claude", e.message.slice(0, 120))); }
    }
    msg(res.join(" · ") || x("sansCle"), res.length && !res.some(r => r.includes(":")));
  };
  $i("ia-eff").onclick = () => { CLES = {gemini: "", anthropic: ""}; st.set("cles", CLES); st.del("gmodele"); d.remove(); rendre(); };
  $i("ia-pfx").onclick = () => d.remove();
}

function panneauOrdre(isin) {
  $i("ia-ordre")?.remove();
  let sens = "achat";
  const f0 = isin ? PAR_ISIN[isin] : null;
  const d = document.createElement("div"); d.className = "ia-pan"; d.id = "ia-ordre";
  d.innerHTML = `<h3>${x("ordTitre")}</h3>
    <label>${x("ordVal")}<select id="io-val">${[...V].sort((a, b) => a.nom.localeCompare(b.nom, "fr")).map(f => `<option value="${echap(f.isin)}"${f0 && f0.isin === f.isin ? " selected" : ""}>${echap(f.nom)}</option>`).join("")}</select></label>
    <div class="ia-seg"><button type="button" class="on" data-s="achat">${x("achat")}</button><button type="button" data-s="vente">${x("vente")}</button></div>
    <div class="ia-2"><label>${x("prix")}<input id="io-prix" type="number" step="0.01" inputmode="decimal"></label>
      <label>${x("qte")}<input id="io-qte" type="number" inputmode="numeric"></label>
      <label>${x("obj")}<input id="io-obj" type="number" step="0.5" inputmode="decimal" value="${R.obj}"></label>
      <label>${x("seuil")}<input id="io-seuil" type="number" step="0.5" inputmode="decimal" value="${R.seuil}"></label></div>
    <p class="ia-ko" id="io-err" hidden>${x("ordManque")}</p>
    <div class="ia-acts"><button class="ia-bt" id="io-go" type="button">${x("ordGo")}</button><button class="ia-bt" id="io-x" type="button">${x("fermer")}</button></div>`;
  $i("ia-fil").appendChild(d); enBas();
  const prixDefaut = () => { const f = PAR_ISIN[$i("io-val").value]; if (f) $i("io-prix").value = f.cours; };
  prixDefaut(); $i("io-val").onchange = prixDefaut;
  d.querySelectorAll(".ia-seg button").forEach(b => b.onclick = () => { sens = b.dataset.s; d.querySelectorAll(".ia-seg button").forEach(y => y.classList.toggle("on", y === b)); });
  $i("io-x").onclick = () => d.remove();
  $i("io-go").onclick = () => {
    const f = PAR_ISIN[$i("io-val").value], prix = parseFloat(String($i("io-prix").value).replace(",", ".")), qte = parseInt($i("io-qte").value, 10);
    if (!f || !(prix > 0) || !(qte > 0)) { $i("io-err").hidden = false; return; }
    d.remove();
    demander(x("ordMsg", {sens, qte, val: `${f.nom} (${f.isin})`, prix, obj: $i("io-obj").value || R.obj, seuil: $i("io-seuil").value || R.seuil}));
  };
}

/* ---------- Événements ---------- */
$i("ia-fab").onclick = ouvrir;
$i("ia-x").onclick = fermerIA;
$i("ia-rg").onclick = panneauCles;
$i("ia-form").addEventListener("submit", e => { e.preventDefault(); const v = $i("ia-in").value; $i("ia-in").value = ""; taille(); demander(v); });
const taille = () => { const s = $i("ia-in"); s.style.height = "auto"; s.style.height = Math.min(130, s.scrollHeight) + "px"; };
$i("ia-in").addEventListener("input", taille);
$i("ia-in").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && matchMedia("(hover: hover)").matches) { e.preventDefault(); $i("ia-form").requestSubmit(); } });
$i("ia-chips").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.ordre) return panneauOrdre();
  if (b.dataset.raz) { FIL = []; st.set("fil", FIL); return rendre(); }
  demander(b.textContent);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$i("ia").hidden) fermerIA(); });

// API publique pour le reste de l'application (bouton IA de l'en-tête, fiche d'une valeur).
window.BVC_IA = {
  ouvrir,
  analyser(isin) { const f = PAR_ISIN[isin]; ouvrir(); if (f) demander(x("ficheQ", `${f.nom} (${f.isin})`)); },
  verifier(isin) { ouvrir(); panneauOrdre(isin); },
  langue() { if (!$i("ia").hidden) rendre(); }
};
})();
