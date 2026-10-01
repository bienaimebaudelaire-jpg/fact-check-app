# Contribuer à fact-check-app

Merci de votre intérêt pour ce projet ! Ce guide est volontairement court.

## Démarrer en local

```bash
npm install
npm run dev
```

## Avant d'ouvrir une pull request

```bash
npm run lint
npm run test
npm run build
```

Ces trois commandes tournent aussi en CI (`.github/workflows/ci.yml`) sur chaque
push et pull request ; elles doivent passer avant la revue.

## Style de code

- TypeScript strict, composants React dans `components/`, logique pure dans `lib/`.
- Pas de dépendance ni de refactor non lié à la pull request.
- Voir `.github/copilot-instructions.md` et `CLAUDE.md` pour les conventions
  spécifiques au projet (double jauge fiabilité/confiance, pas de score
  inventé, autorité humaine sur le verdict final, etc.).

## Pull requests

- Décrivez le changement et sa motivation.
- Gardez les PR focalisées sur un seul sujet.
- Ajoutez/actualisez les tests (`vitest`) pour tout changement de
  comportement dans `lib/`.

## Signaler un problème de sécurité

Merci de ne **pas** ouvrir d'issue publique : voir [SECURITY.md](./SECURITY.md).
