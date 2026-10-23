#!/usr/bin/env node
// Banc de test de /api/verifier : envoie un jeu d'affirmations à l'app (locale ou déployée) et mesure.
// Aucune dépendance, aucune clé : la clé Google reste côté serveur de l'app testée.
//
//   npm run dev                                   # dans un terminal
//   npm run bench                                 # dans un autre (http://localhost:3000)
//   npm run bench -- --base https://mon-app.vercel.app
//   npm run bench -- --baseline bench/results/<fichier>.json --strict
//
// Options : --base <url>  --claims <fichier>  --out <fichier>  --baseline <fichier>
//           --delay <ms> (400)  --timeout <ms> (20000)  --strict  --help

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { diffRuns, paraphraseConsistency, renderReport, summarize } from './metrics.mjs'

const here = dirname(fileURLToPath(import.meta.url))

const HELP = `Usage : npm run bench -- [options]
  --base <url>        app à tester (défaut http://localhost:3000)
  --claims <fichier>  jeu d'affirmations (défaut bench/claims.fr.json)
  --out <fichier>     résultats JSON (défaut bench/results/<horodatage>.json, + un .md à côté)
  --baseline <f>      résultats précédents à comparer
  --delay <ms>        pause entre deux requêtes (défaut 400)
  --timeout <ms>      délai maximal par requête (défaut 20000)
  --strict            code de sortie 1 s'il y a régression ou attente non respectée`

function parseArgs(argv) {
  const opts = { base: 'http://localhost:3000', claims: resolve(here, 'claims.fr.json'), delay: 400, timeout: 20000 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Valeur manquante pour ${a}`)
      return argv[++i]
    }
    if (a === '--base') opts.base = next()
    else if (a === '--claims') opts.claims = resolve(next())
    else if (a === '--out') opts.out = resolve(next())
    else if (a === '--baseline') opts.baseline = resolve(next())
    else if (a === '--delay') opts.delay = Number(next())
    else if (a === '--timeout') opts.timeout = Number(next())
    else if (a === '--strict') opts.strict = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`Option inconnue : ${a}`)
  }
  if (!Number.isFinite(opts.delay) || opts.delay < 0) throw new Error('--delay doit être un nombre >= 0')
  if (!Number.isFinite(opts.timeout) || opts.timeout <= 0) throw new Error('--timeout doit être un nombre > 0')
  return opts
}

// Saisies invalides : le comportement attendu découle de app/api/verifier/route.ts (HTTP 400).
// 501 = MAX_QUERY_LENGTH (500, lib/google-factcheck.ts) + 1 : si la limite change, l'attente le signalera.
const INVALID_CASES = [
  { id: 'invalid-empty', category: 'invalid', expect: 'error', http: 400, text: '' },
  { id: 'invalid-too-long', category: 'invalid', expect: 'error', http: 400, text: 'a'.repeat(501) },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pick = (v) => ({
  reviewedClaim: v.reviewedClaim,
  publisherSite: v.publisherSite,
  rating: v.rating, // note du média, telle quelle : jamais traduite ni convertie
  reviewDate: v.reviewDate,
  url: v.url,
})

async function ask(base, text, runId, timeout) {
  const url = new URL('/api/verifier', base)
  url.searchParams.set('q', text)
  // Paramètre ignoré par la route, mais qui change la clé de cache : la route répond « s-maxage=3600 »,
  // sans lui une exécution réalisée sur Vercel dans l'heure suivante lirait le cache, pas le code courant.
  url.searchParams.set('_bench', runId)
  const started = Date.now()
  let res
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeout) })
  } catch (error) {
    return { httpStatus: 0, status: 'error', message: `injoignable (${error?.name ?? 'erreur'})`, reviews: [], ms: Date.now() - started }
  }
  const body = await res.json().catch(() => null)
  const status = body && ['found', 'none', 'error'].includes(body.status) ? body.status : 'error'
  const message = body?.message ?? (body ? undefined : 'réponse non JSON')
  const reviews = status === 'found' && Array.isArray(body.reviews) ? body.reviews.map(pick) : []
  return { httpStatus: res.status, status, message, reviews, ms: Date.now() - started }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(HELP)
    return 0
  }

  const dataset = JSON.parse(await readFile(opts.claims, 'utf8'))
  const cases = [...dataset.claims, ...INVALID_CASES]
  const runId = Date.now().toString(36)
  const records = []
  let incomplete = false

  for (const c of cases) {
    const result = await ask(opts.base, c.text, runId, opts.timeout)

    // Serveur injoignable dès la première requête : inutile de continuer, rien n'a été mesuré.
    if (records.length === 0 && result.httpStatus === 0) {
      console.error(`Impossible de joindre ${opts.base} (${result.message}). Lancez « npm run dev » ou passez --base <url>.`)
      return 2
    }

    records.push({ ...c, ...result })
    process.stderr.write(`${records.length}/${cases.length} ${c.id} → ${result.status}\n`)

    // Le route renvoie 502 + « Trop de demandes » quand Google répond 429 : on s'arrête sans insister.
    if (result.httpStatus === 502 && /trop de demandes/i.test(result.message ?? '')) {
      incomplete = true
      console.error('Quota atteint côté Google : exécution interrompue. Réessayez plus tard, avec --delay plus grand.')
      break
    }
    await sleep(opts.delay)
  }

  const meta = { runAt: new Date().toISOString(), base: opts.base, claimsVersion: dataset.version, node: process.version, incomplete }
  const summary = summarize(records)
  const consistency = paraphraseConsistency(records)

  let diff
  if (opts.baseline) {
    const baseline = JSON.parse(await readFile(opts.baseline, 'utf8'))
    diff = diffRuns(baseline.records ?? [], records)
  }

  const report = renderReport({ meta, summary, consistency, diff })
  const out = opts.out ?? resolve(here, 'results', `${meta.runAt.replace(/[:.]/g, '-')}.json`)
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, `${JSON.stringify({ meta, records }, null, 2)}\n`)
  await writeFile(out.replace(/\.json$/, '') + '.md', `${report}\n`)

  console.log(report)
  console.log(`Résultats : ${out}`)

  if (opts.strict && (summary.flags.expectationMismatches.length || diff?.regressions.length)) return 1
  return 0
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(2)
  },
)
