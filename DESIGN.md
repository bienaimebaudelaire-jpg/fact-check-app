# DESIGN.md — fact-check-app

## Direction
« La phrase sous examen ». L'affirmation que l'utilisateur colle est traitée comme une citation :
de grands guillemets français encadrent le champ de saisie, et le résultat la reprend en italique
entre guillemets. Ton sobre, service public, rassurant : on vérifie calmement, sans alarmisme.

## Palette
- `--paper` #f3f4f1 (fond, gris papier froid) · `--sheet` #fbfbf9 (surfaces)
- `--rule` #d5d9d3 (filets, bordures, guillemets au repos)
- `--ink` #172033 (texte, bleu encre) · `--ink-soft` #505a6b
- Verdicts : `--verified` #1e6b52 / `--false` #a6402b / `--uncertain` #a9781f

## Typographie
- `font-display` : Literata — titres et citations (serif de lecture, sérieux sans être académique)
- Corps : Public Sans — police conçue pour les services publics, chiffres tabulaires

## Motifs signature
1. Guillemets « » géants autour du champ (`.quote-frame`), qui passent à l'encre au focus.
2. Verdict en tampon encreur (`.stamp`), conservé de la version précédente.
3. La fiabilité en **balance** (contredit ← 50 → soutient), marqueur à la couleur du verdict :
   elle dit dans quel sens penchent les sources, ce n'est pas une barre de progression.
   Masquée quand le verdict est « impossible à déterminer ». La confiance reste une barre neutre, à part.

## À ne pas faire
- Pas de libellés en MAJUSCULES espacées ni de police mono pour décorer.
- Pas de cartes blanches arrondies avec ombre grise générique.
- Toujours écrire avec les accents (vérifier, méthode, fiabilité…).
- Pas de tableau pour les sources (illisible sur mobile) : une liste, filet gauche à la couleur de la position.
