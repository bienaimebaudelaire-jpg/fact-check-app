# STATUS.md — fact-check-app

## Etat actuel (2026-09-20)
- V1 texte deployee : https://fact-check-app-bienaimebaudelaire-jpg.vercel.app
- Moteur de classification (7 verdicts, double jauge fiabilite/confiance) fonctionnel avec
  4 exemples de demonstration (sources mockees mais detaillees).
- Action GitHub officielle de revue de securite installee (secret CLAUDE_API_KEY a ajouter
  par l'utilisateur pour l'activer).
- Design signature "dossier/tampon" applique.

## Prochaine etape technique (pas commencee)
Remplacer les tableaux d'evidence mockes par un vrai pipeline de recherche de sources,
en respectant la hierarchie definie dans la spec produit (officiel > institutionnel >
presse > fact-checkers tiers > non verifiable).

## Limitation connue
Voir CLAUDE.md -- cas ou reliabilityScore affiche 50% par defaut quand aucune source
exploitable n'est disponible, alors que le verdict est deja "undetermined".
