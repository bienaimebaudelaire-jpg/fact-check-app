# DESIGN.md — fact-check-app

## Direction
Identite "dossier d'enquete" : papier, encre, tampon de verdict. Choisi pour eviter le kit
SaaS generique (cartes arrondies, ombre grise, palette bleu/vert par defaut) et ancrer le
design dans le sujet (verification, dossier, preuve).

## Palette
- `--paper` #efece2 (fond)
- `--paper-line` #d9d3bf (lignes, bordures)
- `--ink` #1c2130 (texte)
- `--verified` #1e6b52 / `--false` #a6402b / `--uncertain` #a9781f (verdicts)

## Typographie
- `font-display` : Source Serif 4 -- titres, autorite editoriale
- `font-mono-data` : IBM Plex Mono -- scores, dates, donnees (lecture d'instrument)
- Corps de texte : IBM Plex Sans

## Motif signature
Le verdict est rendu comme un tampon encreur (`.stamp` dans globals.css) : bordure epaisse,
legere rotation, jamais une pastille de couleur generique.

## A ne pas faire
Ne pas revenir aux cartes blanches arrondies avec ombre douce generique (`shadow-[0_8px_30px...]`,
`rounded-2xl`, `bg-white`) -- c'est exactement le pattern qu'on a delibrement quitte.
