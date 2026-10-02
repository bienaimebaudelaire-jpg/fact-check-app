# Copilot Instructions — fact-check-app

Lire aussi tout fichier SPEC.md/CLAUDE.md present : il fait foi sur le produit.

## Veille avant toute suggestion technique
Avant de proposer une librairie, un framework, une version ou une approche :
1. Verifier qu'elle n'est pas obsolete ou depreciee (changelog recent, derniere mise a jour).
2. Verifier qu'elle est parmi les choix les plus utilises/eprouves pour ce cas d'usage (pas juste la premiere connue).
3. Signaler explicitement si une alternative plus recente ou plus performante existe, meme si ce n'est pas ce qui est demande.
4. Ne jamais inventer une donnee, un prix, une statistique ou une source : verifier ou dire qu'on ne sait pas.

## Avant de livrer du code
- Se relire une fois pour la logique, une fois pour les erreurs/failles evidentes (secrets en dur, entrees non validees, valeurs par defaut trompeuses).
- Optimiser pour : ergonomie/intuitivite, performance raisonnable, cout d'infrastructure maitrise.
- Rester dans le perimetre demande : proposer un elargissement en option, jamais l'imposer.

## Style
- Reponses et commentaires de code en francais si le repo est en francais, code en anglais.
- Etre direct sur les limites ou risques d'un choix, ne jamais les cacher pour "faire plaisir".
