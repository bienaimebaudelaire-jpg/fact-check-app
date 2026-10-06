# Intégration NVIDIA OpenShell

Wrapper optionnel autour du CLI `openshell` (runtime sandbox pour agents) : `lib/openshell.ts`, types dans `lib/openshell-types.ts`.

- **Pas de dépendance npm** : OpenShell n'est pas publié sur npm (installation via le script officiel NVIDIA ou le paquet Python `openshell`). Rien n'est donc ajouté à `package.json` ; le binaire est optionnel, son absence donne `ok: false`.
- Binaire : `OPENSHELL_BIN` (défaut `openshell`). Exécution via `execFile` (sans shell), arguments validés, timeout 30 s.
- Le wrapper n'émet aucun verdict : le verdict final reste humain.
- Côté serveur uniquement.

```ts
import { runOpenShell } from '@/lib/openshell'

const res = await runOpenShell({ kind: 'sandbox-create', from: 'base', name: 'fact-check' })
if (!res.ok) console.error(res.stderr)
await runOpenShell({ kind: 'sandbox-exec', name: 'fact-check', command: ['echo', 'ok'] })
await runOpenShell({ kind: 'sandbox-delete', name: 'fact-check' })
```
