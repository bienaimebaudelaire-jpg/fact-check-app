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


## Revue de code du 2026-09-20 (corrigee le 2026-09-22, voir issue #1)

Quand toutes les sources d'une affirmation sont niveau 5 (non verifiables) ou qu'il n'y a
aucune source, `reliabilityScore` retombe a 50 par defaut (neutre mathematique), alors meme
que le verdict est `undetermined`. La jauge de fiabilite est maintenant masquee (pas juste
expliquee) quand `result.verdict === 'undetermined'`, dans `components/fact-check-results.tsx`
(carte de resultat et carte de partage) : ne pas reintroduire un affichage de pourcentage brut
dans ce cas.

## Revue de code du 2026-09-22 (corrigee, voir issue #1)

`evidenceForClaim()` matchait par sous-chaine (`claim.includes(candidate)`), ce qui rattachait
des preuves fixes a n'importe quel texte contenant un mot-cle — y compris une negation
(« Les humains n'ont jamais marche sur la Lune » recevait les preuves qui *soutiennent*
l'alunissage) ou un sujet hors-sujet contenant le mot « vaccin ». La cle `'éoliennes'` accentuee
ne matchait jamais le texte d'exemple non accentue de `app/page.tsx`. Corrige par une
correspondance **exacte** apres normalisation (`normalizeClaim` : NFD, minuscules, accents et
ponctuation retires) contre les 4 exemples de demonstration definis dans
`lib/factcheck-engine.ts` (`demoClaimExamples`, source unique reutilisee par `app/page.tsx`).
Toute autre saisie ne declenche plus `analyzeClaim` du tout : voir l'etat « Demo » dans
`app/page.tsx`. Ne jamais revenir a un matching par sous-chaine ou mot-cle sur `claim`.
