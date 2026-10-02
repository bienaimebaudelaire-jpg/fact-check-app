import { describe, expect, it } from 'vitest'
import { analyzeClaim, demoClaimExamples, evidenceForClaim, isDemoClaim, normalizeClaim } from './factcheck-engine'

describe('normalizeClaim', () => {
  it('strips accents, lowercases, and collapses punctuation/whitespace', () => {
    expect(normalizeClaim('Les éoliennes produisent plus d’électricité qu’elles n’en consomment.')).toBe(
      normalizeClaim('Les eoliennes produisent plus d electricite qu elles n en consomment.'),
    )
    expect(normalizeClaim('  Été,   café !! ')).toBe('ete cafe')
  })
})

describe('evidenceForClaim / isDemoClaim — les 4 exemples', () => {
  it('reconnaissent chacun des 4 exemples officiels', () => {
    for (const example of demoClaimExamples) {
      expect(isDemoClaim(example.text)).toBe(true)
      expect(evidenceForClaim(example.text).length).toBeGreaterThan(0)
    }
  })

  it('reconnaissent les exemples sans accents (variante bug #1)', () => {
    const withoutAccents = 'Les eoliennes produisent plus d electricite qu elles n en consomment.'
    expect(isDemoClaim(withoutAccents)).toBe(true)
    expect(evidenceForClaim(withoutAccents)).toEqual(evidenceForClaim('Les éoliennes produisent plus d’électricité qu’elles n’en consomment.'))
  })

  it('ne rattachent aucune preuve a une negation de l’exemple Lune (bug #1)', () => {
    const negated = 'Les humains n’ont jamais marché sur la Lune.'
    expect(isDemoClaim(negated)).toBe(false)
    expect(evidenceForClaim(negated)).toEqual([])
  })

  it('ne rattachent aucune preuve a une phrase hors-sujet contenant "vaccin" (bug #1)', () => {
    const offTopic = 'Les vaccins causent l’autisme.'
    expect(isDemoClaim(offTopic)).toBe(false)
    expect(evidenceForClaim(offTopic)).toEqual([])
  })

  it('ne rattachent aucune preuve a un texte libre quelconque', () => {
    expect(isDemoClaim('Le ciel est bleu.')).toBe(false)
    expect(evidenceForClaim('')).toEqual([])
  })
})

describe('analyzeClaim — verdicts attendus des 4 exemples', () => {
  it('Lune : toutes les sources soutiennent -> verdict verifie, sans ambiguite', () => {
    const example = demoClaimExamples.find((e) => e.text.includes('Lune'))!
    const evidence = evidenceForClaim(example.text)
    const result = analyzeClaim(example.text, evidence)
    expect(result.verdict).toBe('verified')
    expect(result.reliabilityScore).toBe(100)
  })

  it('Vaccins contre la grippe : toutes les sources contredisent -> verdict faux, sans ambiguite', () => {
    const example = demoClaimExamples.find((e) => e.text.includes('vaccin'))!
    const evidence = evidenceForClaim(example.text)
    const result = analyzeClaim(example.text, evidence)
    expect(result.verdict).toBe('false')
    expect(result.reliabilityScore).toBe(0)
  })

  it('Eoliennes : sources majoritairement favorables -> verdict directionnel positif', () => {
    const example = demoClaimExamples.find((e) => e.text.includes('olienne'))!
    const evidence = evidenceForClaim(example.text)
    const result = analyzeClaim(example.text, evidence)
    expect(result.verdict).not.toBe('undetermined')
    expect(['verified', 'very_likely_true', 'partially_true']).toContain(result.verdict)
    expect(result.reliabilityScore).toBeGreaterThan(50)
  })

  it('Transport ferroviaire : sources mixtes sans conflit de meme niveau -> pas de verdict indetermine', () => {
    const example = demoClaimExamples.find((e) => e.text.includes('ferroviaire'))!
    const evidence = evidenceForClaim(example.text)
    const result = analyzeClaim(example.text, evidence)
    expect(result.verdict).not.toBe('undetermined')
  })

  it('aucun verdict directionnel n’est produit hors des 4 exemples', () => {
    const evidence = evidenceForClaim('Les humains n’ont jamais marché sur la Lune.')
    const result = analyzeClaim('Les humains n’ont jamais marché sur la Lune.', evidence)
    expect(result.verdict).toBe('undetermined')
  })
})

describe('explanation text', () => {
  it('does not end a sentence with a doubled period when a detail already ends with one', () => {
    const claim = demoClaimExamples.find((e) => e.text.includes('Lune'))!.text
    const { explanation } = analyzeClaim(claim, evidenceForClaim(claim))
    expect(explanation).not.toMatch(/\.\./)
  })

  it('reads grammatically for a single usable source in the undetermined case', () => {
    const { verdict, explanation } = analyzeClaim('x', [
      { sourceName: 'Seule source', sourceLevel: 1, stance: 'supports', dateChecked: '2026-01-01' },
    ])
    expect(verdict).toBe('undetermined')
    expect(explanation).toContain('une seule source indépendante')
    expect(explanation).not.toMatch(/source indépendante de niveau 1 à 3 ne suffisent/)
  })
})
