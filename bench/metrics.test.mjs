import { describe, expect, it } from 'vitest'
import {
  LOW_RELEVANCE,
  diffRuns,
  expectationMismatch,
  jaccard,
  paraphraseConsistency,
  queryCoverage,
  renderReport,
  summarize,
  tokens,
} from './metrics.mjs'

const review = (url, reviewedClaim = 'x', publisherSite = 'francetvinfo.fr') => ({
  reviewedClaim,
  publisherSite,
  rating: 'Faux',
  url,
})

const rec = (id, status, extra = {}) => ({
  id,
  text: 'Les humains ont marché sur la Lune',
  category: 'topical',
  expect: 'unknown',
  httpStatus: status === 'error' ? 502 : 200,
  status,
  reviews: [],
  ...extra,
})

describe('tokens', () => {
  it('retire accents, mots vides et pluriels, sans doublon', () => {
    expect(tokens('Les éoliennes tuent des oiseaux, les oiseaux')).toEqual(['eolienne', 'tuent', 'oiseau'])
  })

  it('renvoie une liste vide pour une saisie sans mot significatif', () => {
    expect(tokens('le la les')).toEqual([])
  })
})

describe('queryCoverage', () => {
  it('compte la part des mots de la saisie retrouvés dans l\'affirmation vérifiée', () => {
    const covered = queryCoverage('Les humains ont marché sur la Lune', "Les astronautes d'Apollo ont-ils marché sur la Lune ?")
    expect(covered).toBeCloseTo(2 / 3, 5)
  })

  it('vaut 0 sans mot commun et null pour une saisie vide de sens', () => {
    expect(queryCoverage('La Terre est plate', 'Le nucléaire émet du CO2')).toBe(0)
    expect(queryCoverage('le la', 'Le nucléaire')).toBeNull()
  })
})

describe('jaccard', () => {
  it('mesure le recouvrement et renvoie null si les deux listes sont vides', () => {
    expect(jaccard(['a', 'b', 'c'], ['c', 'd'])).toBeCloseTo(0.25, 5)
    expect(jaccard([], [])).toBeNull()
  })
})

describe('expectationMismatch', () => {
  it('ignore expect=unknown', () => {
    expect(expectationMismatch(rec('a', 'none'))).toBeNull()
  })

  it('détecte un témoin négatif qui renvoie found', () => {
    expect(expectationMismatch(rec('c', 'found', { expect: 'none', category: 'control' }))).toEqual({ id: 'c', expect: 'none', got: 'found' })
  })

  it('vérifie aussi le code HTTP d\'une saisie invalide', () => {
    const ok = rec('i1', 'error', { expect: 'error', http: 400, httpStatus: 400 })
    const ko = rec('i2', 'error', { expect: 'error', http: 400, httpStatus: 502 })
    expect(expectationMismatch(ok)).toBeNull()
    expect(expectationMismatch(ko)).toEqual({ id: 'i2', expect: 'error (HTTP 400)', got: 'error (HTTP 502)' })
  })
})

describe('summarize', () => {
  const records = [
    rec('t1', 'found', { reviews: [review('u1', 'Les humains ont marché sur la Lune'), review('u2', 'autre sujet')] }),
    rec('t2', 'none'),
    rec('t3', 'found', { text: 'La Terre est plate', reviews: [review('u3', 'Le nucléaire émet du CO2', 'rfi.fr')] }),
    rec('c1', 'found', { category: 'control', expect: 'none', reviews: [review('u4')] }),
    rec('i1', 'error', { category: 'invalid', expect: 'error', http: 400, httpStatus: 400 }),
  ]
  const summary = summarize(records)

  it('compte found / none / error par catégorie', () => {
    expect(summary.total).toBe(5)
    expect(summary.categories.topical.total).toBe(3)
    expect(summary.categories.topical.found).toBe(2)
    expect(summary.categories.topical.none).toBe(1)
    expect(summary.categories.invalid.error).toBe(1)
  })

  it('compte les médias présents', () => {
    expect(summary.publishers['francetvinfo.fr']).toBe(3)
    expect(summary.publishers['rfi.fr']).toBe(1)
  })

  it('signale témoin négatif, attentes non respectées et faible pertinence', () => {
    expect(summary.flags.controlsFound).toEqual(['c1'])
    expect(summary.flags.expectationMismatches).toEqual([{ id: 'c1', expect: 'none', got: 'found' }])
    expect(summary.flags.lowRelevance).toHaveLength(2)
    expect(summary.flags.lowRelevance[0].bestCoverage < LOW_RELEVANCE).toBe(true)
  })
})

describe('paraphraseConsistency', () => {
  it('compare statuts et liens entre reformulations d\'un même groupe', () => {
    const out = paraphraseConsistency([
      rec('p1', 'found', { group: 'g1', reviews: [review('u1'), review('u2'), review('u3')] }),
      rec('p2', 'found', { group: 'g1', reviews: [review('u3'), review('u4')] }),
      rec('q1', 'found', { group: 'g2', reviews: [review('u1')] }),
      rec('q2', 'none', { group: 'g2' }),
      rec('solo', 'found', { group: 'g3', reviews: [review('u9')] }),
    ])
    expect(out).toHaveLength(2)
    expect(out[0].statusAgree).toBe(true)
    expect(out[0].meanUrlJaccard).toBeCloseTo(0.25, 5)
    expect(out[1].statusAgree).toBe(false)
    expect(out[1].meanUrlJaccard).toBeNull()
  })
})

describe('diffRuns', () => {
  const base = [
    rec('a', 'found', { reviews: [review('u1'), review('u2')] }),
    rec('b', 'none'),
    rec('c', 'found', { reviews: [review('u1')] }),
    rec('d', 'found', { reviews: [review('u1')] }),
    rec('gone', 'none'),
  ]
  const current = [
    rec('a', 'found', { reviews: [review('u1'), review('u3')] }),
    rec('b', 'found', { reviews: [review('u5')] }),
    rec('c', 'none'),
    rec('d', 'error'),
    rec('fresh', 'none'),
  ]
  const diff = diffRuns(base, current)

  it('considère found -> none/error comme une régression, pas none -> found', () => {
    expect(diff.regressions.map((r) => r.id)).toEqual(['c', 'd'])
    expect(diff.changes.find((c) => c.id === 'b').regression).toBe(false)
  })

  it('traite les liens qui changent entre deux found comme une dérive', () => {
    expect(diff.drift).toEqual([{ id: 'a', added: 1, removed: 1 }])
  })

  it('liste les identifiants présents d\'un seul côté', () => {
    expect(diff.onlyInBase).toEqual(['gone'])
    expect(diff.onlyInCurrent).toEqual(['fresh'])
  })
})

describe('renderReport', () => {
  it('produit un rapport lisible, sans verdict global', () => {
    const records = [rec('t1', 'found', { reviews: [review('u1', 'Les humains ont marché sur la Lune')] }), rec('t2', 'none')]
    const text = renderReport({
      meta: { runAt: '2026-10-23T00:00:00.000Z', base: 'http://localhost:3000', incomplete: false },
      summary: summarize(records),
      consistency: [],
    })
    expect(text.includes('## Couverture par catégorie')).toBe(true)
    expect(text.includes('| topical | 2 | 1 | 1 | 0 |')).toBe(true)
    expect(text.includes('Rien à signaler.')).toBe(true)
  })
})
