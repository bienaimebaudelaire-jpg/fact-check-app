import { describe, expect, it } from 'vitest'
import {
  approveProposal,
  prepareFactCheckProposal,
  preparePublishableFactCheck,
} from './automaton-prep'

describe('prepareFactCheckProposal', () => {
  it('marque explicitement la provenance mockee pour une demo locale', () => {
    const proposal = prepareFactCheckProposal(
      {
        claim: 'Les humains ont marché sur la Lune.',
        runtime: 'automaton-prep',
        requestedAt: '2026-09-24T00:00:00.000Z',
      },
      { collectedAt: '2026-09-24T00:00:00.000Z' },
    )

    expect(proposal.evidence.length).toBeGreaterThan(0)
    expect(proposal.finalVerdictAuthority).toBe('human_only')
    expect(proposal.evidence.every((item) => item.mocked)).toBe(true)
    expect(proposal.evidence.every((item) => item.provenance.provider === 'local-demo-dataset')).toBe(true)
    expect(proposal.evidence.every((item) => item.provenance.retrievalMode === 'local_mock')).toBe(true)
    expect(proposal.evidence.every((item) => item.provenance.connectorConfigured === false)).toBe(true)
    expect(proposal.evidence.every((item) => item.provenance.note.includes('aucune collecte réseau réelle'))).toBe(true)
    expect(proposal.warnings.some((warning) => warning.code === 'MOCK_EVIDENCE')).toBe(true)
    expect(proposal.warnings.some((warning) => warning.code === 'HUMAN_APPROVAL_REQUIRED')).toBe(true)
  })

  it('signale les champs necessitant un vrai connecteur quand aucune source locale ne s’applique', () => {
    const proposal = prepareFactCheckProposal({
      claim: 'Les batteries solides sont deployeees partout.',
      runtime: 'automaton-prep',
      requestedAt: '2026-09-24T00:00:00.000Z',
    })

    expect(proposal.evidence).toEqual([])
    expect(proposal.analysis.verdict).toBe('undetermined')
    expect(proposal.warnings.some((warning) => warning.code === 'CONNECTOR_REQUIRED' && warning.field === 'provenance')).toBe(true)
  })

  it('conserve fiabilite et confiance comme deux dimensions distinctes', () => {
    const proposal = prepareFactCheckProposal({
      claim: 'Les humains ont marché sur la Lune.',
      runtime: 'automaton-prep',
      requestedAt: '2026-09-24T00:00:00.000Z',
    })

    expect(typeof proposal.analysis.reliabilityScore).toBe('number')
    expect(typeof proposal.analysis.confidenceScore).toBe('number')
    expect(proposal.analysis.reliabilityScore).not.toBe(proposal.analysis.confidenceScore)
  })
})

describe('preparePublishableFactCheck', () => {
  it('bloque toute publication tant que la validation humaine n’est pas approuvee', () => {
    const proposal = prepareFactCheckProposal({
      claim: 'Les humains ont marché sur la Lune.',
      runtime: 'automaton-prep',
      requestedAt: '2026-09-24T00:00:00.000Z',
    })

    expect(() => preparePublishableFactCheck(proposal)).toThrow('Publication interdite : validation humaine requise.')

    const approved = approveProposal(proposal, 'analyste-humain', '2026-09-24T00:30:00.000Z')
    expect(preparePublishableFactCheck(approved)).toMatchObject({
      claim: 'Les humains ont marché sur la Lune.',
      approvedBy: 'analyste-humain',
      approvedAt: '2026-09-24T00:30:00.000Z',
    })
  })

  it('reste non publiable apres approbation si un connecteur reel reste requis', () => {
    const proposal = prepareFactCheckProposal({
      claim: 'Les batteries solides sont deployeees partout.',
      runtime: 'automaton-prep',
      requestedAt: '2026-09-24T00:00:00.000Z',
    })

    const approved = approveProposal(proposal, 'analyste-humain', '2026-09-24T00:30:00.000Z')

    expect(approved.publication.allowed).toBe(false)
    expect(() => preparePublishableFactCheck(approved)).toThrow(
      'Publication interdite : preuves exploitables requises avant publication.',
    )
  })
})
