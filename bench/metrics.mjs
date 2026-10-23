// Mesures du banc de test de /api/verifier. Fonctions pures, sans dépendance.
//
// Ce que le banc mesure : la couverture (found / none / error), la pertinence LEXICALE des vérifications
// renvoyées (un proxy, pas un jugement), la stabilité face aux reformulations, les régressions entre deux
// exécutions. Il ne mesure jamais « le bon verdict » : l'app n'en calcule pas (voir CLAUDE.md) et on
// n'invente ni score ni verdict de référence. Les notes des médias (rating) sont transportées telles quelles.

/** En dessous de ce taux de mots de la saisie retrouvés dans l'affirmation vérifiée, on signale « peu pertinent ». */
export const LOW_RELEVANCE = 0.5

const STATUSES = ['found', 'none', 'error']

// Mots vides courants, en forme normalisée (sans accents, minuscules).
const STOPWORDS = new Set([
  'les', 'des', 'une', 'aux', 'est', 'sont', 'ont', 'ils', 'elle', 'elles', 'cet', 'cette', 'ces', 'que', 'qui',
  'quoi', 'dans', 'sur', 'par', 'pour', 'avec', 'sans', 'pas', 'ete', 'etre', 'avoir', 'vrai', 'vraiment', 'plus',
  'tout', 'tous', 'toute', 'toutes', 'ainsi', 'mais', 'donc', 'car', 'comme', 'entre', 'leur', 'leurs', 'son',
  'ses', 'mon', 'mes', 'ton', 'tes', 'nos', 'vos', 'notre', 'votre', 'fait', 'fais', 'peut', 'vont',
])

/** Minuscules, sans accents ni ponctuation. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
}

// Racinisation minimale : pluriels en -s / -x (« éoliennes » ~ « éolienne », « oiseaux » ~ « oiseau »).
const stem = (t) => (t.length > 4 ? t.replace(/[sx]$/, '') : t)

/** Mots significatifs d'un texte, dédoublonnés, dans l'ordre d'apparition. */
export function tokens(text) {
  const out = []
  for (const raw of normalize(text).split(/\s+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue
    const t = stem(raw)
    if (!out.includes(t)) out.push(t)
  }
  return out
}

/**
 * Part des mots significatifs de la saisie retrouvés dans l'affirmation que le média a vérifiée (0..1).
 * `null` si la saisie n'a aucun mot significatif. Proxy lexical : ne dit rien de la justesse.
 */
export function queryCoverage(query, reviewedClaim) {
  const q = tokens(query)
  if (q.length === 0) return null
  const c = new Set(tokens(reviewedClaim))
  return q.filter((t) => c.has(t)).length / q.length
}

/** Indice de Jaccard entre deux listes (0..1). `null` si les deux sont vides. */
export function jaccard(a, b) {
  const A = new Set(a)
  const B = new Set(b)
  if (A.size === 0 && B.size === 0) return null
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
const statusOf = (r) => (STATUSES.includes(r.status) ? r.status : 'error')
const urlsOf = (r) => (r.reviews ?? []).map((v) => v.url)

/** Meilleure couverture lexicale parmi les vérifications renvoyées (`null` si aucune ou saisie vide). */
export function bestCoverage(record) {
  const values = (record.reviews ?? [])
    .map((v) => queryCoverage(record.text, v.reviewedClaim))
    .filter((x) => x !== null)
  return values.length ? Math.max(...values) : null
}

/**
 * Une attente (`expect`) n'existe que quand elle découle du code ou d'un témoin négatif :
 * `error` (+ `http` optionnel) pour une saisie invalide, `none` pour un témoin, `unknown` sinon (rien à vérifier).
 */
export function expectationMismatch(record) {
  const expect = record.expect
  if (!STATUSES.includes(expect)) return null
  const status = statusOf(record)
  if (status !== expect) return { id: record.id, expect, got: status }
  if (expect === 'error' && record.http != null && record.httpStatus !== record.http) {
    return { id: record.id, expect: `error (HTTP ${record.http})`, got: `error (HTTP ${record.httpStatus})` }
  }
  return null
}

export function summarize(records) {
  const byCategory = {}
  const publishers = {}
  const expectationMismatches = []
  const controlsFound = []
  const lowRelevance = []

  for (const r of records) {
    const status = statusOf(r)
    const c = (byCategory[r.category] ??= { total: 0, found: 0, none: 0, error: 0, reviews: [], coverage: [] })
    c.total++
    c[status]++

    if (status === 'found') {
      c.reviews.push((r.reviews ?? []).length)
      const best = bestCoverage(r)
      if (best !== null) {
        c.coverage.push(best)
        if (best < LOW_RELEVANCE) lowRelevance.push({ id: r.id, bestCoverage: best })
      }
      for (const v of r.reviews ?? []) publishers[v.publisherSite] = (publishers[v.publisherSite] ?? 0) + 1
      if (r.category === 'control' || r.category === 'gibberish') controlsFound.push(r.id)
    }

    const mismatch = expectationMismatch(r)
    if (mismatch) expectationMismatches.push(mismatch)
  }

  const categories = {}
  for (const [name, c] of Object.entries(byCategory)) {
    categories[name] = {
      total: c.total,
      found: c.found,
      none: c.none,
      error: c.error,
      meanReviewsWhenFound: mean(c.reviews),
      meanBestCoverage: mean(c.coverage),
    }
  }

  return {
    total: records.length,
    categories,
    publishers,
    flags: { expectationMismatches, controlsFound, lowRelevance },
  }
}

/** Pour chaque groupe de reformulations : les statuts concordent-ils, et les mêmes liens reviennent-ils ? */
export function paraphraseConsistency(records) {
  const groups = new Map()
  for (const r of records) {
    if (!r.group) continue
    if (!groups.has(r.group)) groups.set(r.group, [])
    groups.get(r.group).push(r)
  }
  const out = []
  for (const [group, rs] of groups) {
    if (rs.length < 2) continue
    const statuses = rs.map(statusOf)
    const pairs = []
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        if (statuses[i] === 'found' && statuses[j] === 'found') pairs.push(jaccard(urlsOf(rs[i]), urlsOf(rs[j])))
      }
    }
    out.push({
      group,
      ids: rs.map((r) => r.id),
      statuses,
      statusAgree: statuses.every((s) => s === statuses[0]),
      meanUrlJaccard: mean(pairs.filter((x) => x !== null)),
    })
  }
  return out
}

/**
 * Compare deux exécutions. Régression : found -> autre chose, ou apparition d'une erreur.
 * Les liens qui apparaissent ou disparaissent entre deux found sont une dérive (de nouvelles vérifications
 * paraissent), pas une régression.
 */
export function diffRuns(baseRecords, currentRecords) {
  const base = new Map(baseRecords.map((r) => [r.id, r]))
  const current = new Map(currentRecords.map((r) => [r.id, r]))
  const changes = []
  const drift = []

  for (const [id, now] of current) {
    const before = base.get(id)
    if (!before) continue
    const from = statusOf(before)
    const to = statusOf(now)
    if (from !== to) {
      changes.push({ id, from, to, regression: (from === 'found' && to !== 'found') || (to === 'error' && from !== 'error') })
    } else if (from === 'found') {
      const a = new Set(urlsOf(before))
      const b = new Set(urlsOf(now))
      const added = [...b].filter((u) => !a.has(u)).length
      const removed = [...a].filter((u) => !b.has(u)).length
      if (added || removed) drift.push({ id, added, removed })
    }
  }

  return {
    changes,
    drift,
    regressions: changes.filter((c) => c.regression),
    onlyInBase: [...base.keys()].filter((id) => !current.has(id)),
    onlyInCurrent: [...current.keys()].filter((id) => !base.has(id)),
  }
}

const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)} %`)
const num = (x) => (x === null || x === undefined ? '–' : x.toFixed(1))

export function renderReport({ meta, summary, consistency, diff }) {
  const lines = []
  lines.push('# Banc /api/verifier', '')
  lines.push(`- Exécuté le ${meta.runAt} sur ${meta.base}`)
  lines.push(`- ${summary.total} requêtes${meta.incomplete ? ' (INCOMPLET : quota atteint, exécution interrompue)' : ''}`)
  lines.push('- Proxy lexical = part des mots de la saisie retrouvés dans l\'affirmation vérifiée par le média. Il ne mesure pas la justesse.', '')

  lines.push('## Couverture par catégorie', '')
  lines.push('| catégorie | total | found | none | error | avis par found | pertinence lexicale (meilleur avis) |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const [name, c] of Object.entries(summary.categories)) {
    lines.push(`| ${name} | ${c.total} | ${c.found} | ${c.none} | ${c.error} | ${num(c.meanReviewsWhenFound)} | ${pct(c.meanBestCoverage)} |`)
  }
  lines.push('')

  const pubs = Object.entries(summary.publishers).sort((a, b) => b[1] - a[1])
  if (pubs.length) {
    lines.push('## Médias présents dans les résultats', '')
    for (const [site, n] of pubs) lines.push(`- ${site} : ${n}`)
    lines.push('')
  }

  const { expectationMismatches, controlsFound, lowRelevance } = summary.flags
  lines.push('## Points à examiner', '')
  if (!expectationMismatches.length && !controlsFound.length && !lowRelevance.length) lines.push('- Rien à signaler.')
  for (const m of expectationMismatches) lines.push(`- Attente non respectée pour ${m.id} : attendu ${m.expect}, obtenu ${m.got}`)
  for (const id of controlsFound) lines.push(`- Témoin négatif ${id} : des vérifications sont renvoyées (faux positif possible de la recherche par mots-clés)`)
  for (const l of lowRelevance) lines.push(`- ${l.id} : found mais peu pertinent (${pct(l.bestCoverage)} des mots retrouvés)`)
  lines.push('')

  if (consistency.length) {
    lines.push('## Stabilité face aux reformulations', '')
    for (const g of consistency) {
      lines.push(`- ${g.group} : statuts ${g.statuses.join(' / ')}${g.statusAgree ? '' : ' (DIVERGENTS)'}, liens communs ${pct(g.meanUrlJaccard)}`)
    }
    lines.push('')
  }

  if (diff) {
    lines.push('## Écarts avec la référence', '')
    if (!diff.changes.length && !diff.drift.length) lines.push('- Aucun écart.')
    for (const c of diff.changes) lines.push(`- ${c.id} : ${c.from} → ${c.to}${c.regression ? ' (RÉGRESSION)' : ''}`)
    for (const d of diff.drift) lines.push(`- ${d.id} : +${d.added} / -${d.removed} liens (dérive normale si de nouvelles vérifications ont paru)`)
    if (diff.onlyInBase.length) lines.push(`- Absents de cette exécution : ${diff.onlyInBase.join(', ')}`)
    if (diff.onlyInCurrent.length) lines.push(`- Nouveaux par rapport à la référence : ${diff.onlyInCurrent.join(', ')}`)
    lines.push('')
  }

  return lines.join('\n')
}
