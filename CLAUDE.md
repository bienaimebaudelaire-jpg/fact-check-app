# CLAUDE.md — fact-check-app

Notes de discipline pour toute future session de code sur ce repo (inspire des remarques d'Andrej Karpathy sur les erreurs frequentes des LLM en code).

## Erreurs deja rencontrees ici — ne pas repeter

1. **Composants manquants** : le premier scaffold v0 referencait `@/components/ui/button` et `@/components/ui/textarea` sans les inclure. Toujours verifier que chaque import `@/...` a un fichier reel avant de commit.
2. **Inference de type trop large** : un objet construit dans un `.map()` avec un champ `direction: impact > 0 ? 'hausse' : ...` s'infere en `string`, pas en union litterale. Caster explicitement (`as 'hausse' | 'baisse' | 'neutre'`) quand le type de retour est plus etroit que ce que TypeScript infere seul.
3. **Versions Tailwind v4** : `tailwindcss` et `@tailwindcss/postcss` doivent etre alignes sur la meme mineure (bug connu de desync sur 4.0.0 -> `ScannerOptions.negated`). Utiliser `^4.2.0` pour les deux, jamais figer `4.0.0` en dur.

## Principes a garder

- Ne jamais fabriquer un score, un verdict ou une source qui n'a pas d'element concret derriere (voir `lib/factcheck-engine.ts`, regle `undetermined` explicite).
- Un changement de design ou de logique = build local (`npm run build`) avant de pousser, quand c'est possible, plutot que de compter sur le build Vercel pour attraper les erreurs de type.
- Garder les deux jauges (fiabilite / confiance) toujours separees, jamais fusionnees en un seul chiffre.


## Revue de code du 2026-09-20 (limitation connue, pas corrigee)

Quand toutes les sources d'une affirmation sont niveau 5 (non verifiables) ou qu'il n'y a
aucune source, `reliabilityScore` retombe a 50 par defaut (neutre mathematique), alors meme
que le verdict est `undetermined`. Un utilisateur qui lit vite peut interpreter "50%" comme
une vraie mesure plutot que comme l'absence de mesure. L'explication textuelle le clarifie
deja, mais si ce cas devient frequent en usage reel, envisager de masquer la jauge de
fiabilite (pas juste l'expliquer) quand le verdict est `undetermined`.
