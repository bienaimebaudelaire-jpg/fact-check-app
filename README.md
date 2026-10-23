# Fact Check — V1 (texte)

Scaffold V1 du produit Fact Check : moteur de classification factuel + double jauge (fiabilité / confiance), généré via v0 puis poussé ici.

## État actuel

- Moteur de scoring pur en TypeScript (`lib/factcheck-engine.ts`) : implémente les 7 verdicts (vérifié, très probablement vrai, partiellement vrai, trompeur, très probablement faux, faux, impossible à déterminer), avec règle explicite d'« impossible à déterminer » quand les sources sont insuffisantes ou contradictoires au même niveau.
- Deux scores indépendants : fiabilité (fonction pondérée du niveau et de la position des sources) et confiance (fonction du nombre/diversité/fraîcheur des sources, jamais du sens du verdict).
- Interface (`app/page.tsx` + `components/fact-check-results.tsx`) : saisie de texte, sélection d'exemples de démonstration (sources mockées), affichage des deux jauges, détail des sources, carte de partage.
- **Ce qui manque encore** : branchement à de vraies sources (recherche web, hiérarchisation officiel/institutionnel/presse/fact-checkers tiers), OCR pour les captures d'écran, module de recontextualisation de citation, revue de neutralité méthodologique (voir la spec complète).

## Prochaine étape technique

Remplacer les tableaux d'`evidence` mockés par un vrai pipeline de recherche de sources, en respectant la hiérarchie de sources définie dans la spec produit.

## Pré-intégration HUMEAN / Automaton (sans réseau)

Une couche locale de préparation est disponible dans `lib/automaton-prep.ts` :

- **Prépare** une proposition de vérification (`prepareFactCheckProposal`) ;
- **Permet ensuite** de remplacer explicitement les preuves de démo par des preuves collectées via connecteur (`attachConnectorEvidence`) ;
- **N'accorde jamais** l'autorité finale au modèle (`finalVerdictAuthority: 'human_only'`) ;
- **Marque explicitement** les preuves de démonstration comme mockées (`mocked: true`) ;
- **Signale** les champs nécessitant un connecteur réel (`sourceUrl`, `retrievalTraceId`, `retrievedByConnector`) ;
- **Bloque** toute publication tant qu'une validation humaine explicite et des preuves réelles non mockées ne sont pas disponibles (`preparePublishableFactCheck`).

Portée actuelle : lecture/recherche locale de démo uniquement. Le verdict final et la publication restent soumis à approbation humaine explicite.

## Recherche en direct : Google Fact Check Tools

L'interface n'utilise plus de sources simulées. Chaque phrase est envoyée à `app/api/verifier/route.ts`,
qui interroge l'API Google Fact Check Tools (`claims:search`, `languageCode=fr` uniquement) côté serveur.

- Seules les vérifications des **médias publics français** listés dans `OFFICIAL_PUBLISHERS`
  (`lib/google-factcheck.ts`) sont retenues.
- Le verdict du média (`textualRating`) est affiché **tel quel**, avec son nom, sa date et le lien,
  à côté de l'affirmation qu'il a réellement vérifiée. Aucun verdict global n'est calculé.
- Aucun résultat retenu : « Impossible à déterminer ». Panne ou quota : « Vérification indisponible »
  (ce n'est pas un verdict).
- Le moteur à 7 verdicts (`lib/factcheck-engine.ts`) et `lib/automaton-prep.ts` restent en place,
  mais l'interface ne les utilise plus.

### Configuration

Variable d'environnement **`GOOGLE_FACT_CHECK_API_KEY`** (voir `.env.example`) :
en local dans `.env.local`, sur Vercel dans Settings > Environment Variables (Production et Preview).
Sans clé, le site affiche « La vérification n'est pas encore configurée sur ce site ».

## Utilisateurs synthétiques et mémoire d'apprentissage

`lib/learning-memory.ts` (en mémoire, sans base externe) sépare strictement `real | synthetic | test` :
utilisateurs, sessions (le mode doit correspondre au type d'utilisateur), événements, éléments de mémoire
(avec provenance et confiance) et évaluations. La mémoire n'est dérivée que de retours explicites
(feedback / correction) ; `retrieveMemory` ne renvoie que le réel par défaut ; `evaluateScenario` refuse
l'origine `real` ; `realTrafficMetrics` ignore tout trafic non réel. Un agent simulé n'est jamais présenté
comme un humain (`originLabel`).

## Banc de test de `/api/verifier`

`npm run bench` envoie un jeu d'affirmations (`bench/claims.fr.json`, 23 + 2 saisies invalides) à l'app
(`http://localhost:3000` par défaut, `--base <url>` pour une app déployée) et mesure :

- la couverture par catégorie (`found` / `none` / `error`) ;
- la pertinence **lexicale** des vérifications renvoyées (part des mots de la saisie retrouvés dans
  l'affirmation que le média a vérifiée : un proxy, pas un jugement de justesse) ;
- la stabilité face aux reformulations d'une même affirmation ;
- avec `--baseline <résultats.json>` (et `--strict` pour un code de sortie 1), les régressions entre deux exécutions.

Il ne mesure pas « le bon verdict » : l'app n'en calcule pas (voir `CLAUDE.md`). Aucune clé n'est nécessaire côté
banc, la clé Google reste côté serveur de l'app testée. Les résultats vont dans `bench/results/` (ignoré par git).
Un paramètre `_bench` est ajouté aux requêtes pour contourner le cache (`s-maxage=3600`) d'une app déployée.
Le calcul des mesures est testé par `npm test` (`bench/metrics.test.mjs`).

## Démarrer en local

```bash
npm install
npm run dev
```
