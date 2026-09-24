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
- **N'accorde jamais** l'autorité finale au modèle (`finalVerdictAuthority: 'human_only'`) ;
- **Marque explicitement** les preuves de démonstration comme mockées (`mocked: true`) ;
- **Signale** les champs nécessitant un connecteur réel (`sourceUrl`, `retrievalTraceId`, `retrievedByConnector`) ;
- **Bloque** toute publication tant qu'une validation humaine explicite et des preuves réelles non mockées ne sont pas disponibles (`preparePublishableFactCheck`).

Portée actuelle : lecture/recherche locale de démo uniquement. Le verdict final et la publication restent soumis à approbation humaine explicite.

## Démarrer en local

```bash
npm install
npm run dev
```
