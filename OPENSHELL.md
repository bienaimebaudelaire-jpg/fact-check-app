# Intégration NVIDIA OpenShell

Wrapper optionnel autour du CLI `openshell` (runtime sandbox pour agents) : `lib/openshell.ts`, types dans `lib/openshell-types.ts`.

- **Pas de dépendance npm** : le wrapper n'appelle que le CLI. Le SDK TypeScript officiel (`@nvidia/openshell-sdk`) existe mais est hébergé sur GitHub Packages (jeton `read:packages` requis) ; il n'est pas utilisé ici. Rien n'est ajouté à `package.json` ; le binaire est optionnel, son absence donne `ok: false`.
- Binaire : `OPENSHELL_BIN` (défaut `openshell`). Exécution via `execFile` (sans shell), arguments validés, timeout 30 s.
- Noms de sandbox : labels DNS-1123 en minuscules (ex. `fact-check`), jamais un nom commençant par `-`.
- Syntaxe `exec` conforme à la doc : `openshell sandbox exec --name <nom> -- <commande…>`.
- Le wrapper n'émet aucun verdict : le verdict final reste humain.
- Côté serveur uniquement. `stderr` peut contenir des données sensibles : ne pas le renvoyer tel quel au navigateur ni le journaliser en clair.
- Les types de commande exposés sont fixes (`sandbox-create`, `sandbox-list`, `sandbox-delete`, `sandbox-exec`) ; ne jamais construire un `OpenShellCommand` à partir d'une saisie utilisateur ou d'une sortie de modèle.

```ts
import { runOpenShell } from '@/lib/openshell'

const res = await runOpenShell({ kind: 'sandbox-create', from: 'base', name: 'fact-check' })
if (!res.ok) console.error(res.stderr)
await runOpenShell({ kind: 'sandbox-exec', name: 'fact-check', command: ['echo', 'ok'] })
await runOpenShell({ kind: 'sandbox-delete', name: 'fact-check' })
```
