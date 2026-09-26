import { describe, expect, it, vi } from 'vitest'
import { OFFICIAL_PUBLISHERS, buildSearchUrl, isOfficialPublisher, normalizeReviews, searchFactChecks } from './google-factcheck'

const KEY = 'test-key'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const franceInfoClaim = {
  text: 'Les vaccins contre la grippe donnent la grippe',
  claimant: 'Publication Facebook',
  claimDate: '2025-10-01T00:00:00Z',
  claimReview: [
    {
      publisher: { name: 'franceinfo', site: 'francetvinfo.fr' },
      url: 'https://www.francetvinfo.fr/vrai-ou-fake/grippe.html',
      title: 'Non, le vaccin ne donne pas la grippe',
      reviewDate: '2025-10-03T08:00:00Z',
      textualRating: 'Faux',
      languageCode: 'fr',
    },
  ],
}

describe('buildSearchUrl', () => {
  it('interroge claims:search en français uniquement, avec la clé et la phrase encodée', () => {
    const url = new URL(buildSearchUrl('Les éoliennes & le CO2 ?', KEY))
    expect(url.origin + url.pathname).toBe('https://factchecktools.googleapis.com/v1alpha1/claims:search')
    expect(url.searchParams.get('query')).toBe('Les éoliennes & le CO2 ?')
    expect(url.searchParams.get('languageCode')).toBe('fr')
    expect(url.searchParams.get('key')).toBe(KEY)
  })
})

describe('isOfficialPublisher', () => {
  it('accepte les sites de la liste et leurs sous-domaines', () => {
    expect(isOfficialPublisher('francetvinfo.fr')).toBe(true)
    expect(isOfficialPublisher('observers.france24.com')).toBe(true)
  })

  it('refuse les autres médias et les faux domaines qui imitent un nom', () => {
    expect(isOfficialPublisher('lemonde.fr')).toBe(false)
    expect(isOfficialPublisher('notfrance24.com')).toBe(false)
    expect(isOfficialPublisher('france24.com.evil.example')).toBe(false)
    expect(isOfficialPublisher(undefined)).toBe(false)
  })

  it('expose une liste publique non vide', () => {
    expect(OFFICIAL_PUBLISHERS.length).toBeGreaterThan(0)
  })
})

describe('normalizeReviews', () => {
  it('reprend le verdict du média mot pour mot, avec son nom, sa date, son lien et l’affirmation vérifiée', () => {
    const [review] = normalizeReviews([franceInfoClaim])
    expect(review).toEqual({
      reviewedClaim: 'Les vaccins contre la grippe donnent la grippe',
      claimant: 'Publication Facebook',
      publisherName: 'franceinfo',
      publisherSite: 'francetvinfo.fr',
      rating: 'Faux',
      reviewDate: '2025-10-03T08:00:00Z',
      url: 'https://www.francetvinfo.fr/vrai-ou-fake/grippe.html',
      title: 'Non, le vaccin ne donne pas la grippe',
    })
  })

  it('ne garde que les médias de la liste officielle', () => {
    const claims = [
      franceInfoClaim,
      { ...franceInfoClaim, claimReview: [{ ...franceInfoClaim.claimReview[0], publisher: { name: 'Le Monde', site: 'lemonde.fr' }, url: 'https://www.lemonde.fr/x' }] },
    ]
    expect(normalizeReviews(claims).map((r) => r.publisherSite)).toEqual(['francetvinfo.fr'])
  })

  it('écarte une vérification sans verdict ou sans lien plutôt que de compléter', () => {
    const noRating = { ...franceInfoClaim, claimReview: [{ ...franceInfoClaim.claimReview[0], textualRating: '' }] }
    const noUrl = { ...franceInfoClaim, claimReview: [{ ...franceInfoClaim.claimReview[0], url: undefined }] }
    expect(normalizeReviews([noRating, noUrl])).toEqual([])
  })

  it('utilise le site comme nom quand le média n’a pas de nom, et tolère une date absente', () => {
    const claim = { text: 'x', claimReview: [{ publisher: { site: 'france24.com' }, url: 'https://www.france24.com/fr/x', textualRating: 'Trompeur' }] }
    const [review] = normalizeReviews([claim])
    expect(review.publisherName).toBe('france24.com')
    expect(review.reviewDate).toBeUndefined()
  })

  it('déduit le site du lien quand publisher.site est absent', () => {
    const claim = { text: 'x', claimReview: [{ publisher: { name: 'RFI' }, url: 'https://www.rfi.fr/fr/x', textualRating: 'Faux' }] }
    expect(normalizeReviews([claim])[0].publisherSite).toBe('rfi.fr')
  })

  it('retire les doublons et trie de la plus récente à la plus ancienne', () => {
    const older = { ...franceInfoClaim.claimReview[0], url: 'https://www.francetvinfo.fr/a', reviewDate: '2024-01-01T00:00:00Z' }
    const newer = { ...franceInfoClaim.claimReview[0], url: 'https://www.francetvinfo.fr/b', reviewDate: '2026-01-01T00:00:00Z' }
    const claims = [
      { text: 'a', claimReview: [older, newer] },
      { text: 'a bis', claimReview: [newer] },
    ]
    expect(normalizeReviews(claims).map((r) => r.url)).toEqual(['https://www.francetvinfo.fr/b', 'https://www.francetvinfo.fr/a'])
  })
})

describe('searchFactChecks', () => {
  it('renvoie les vérifications trouvées, en un seul appel en français', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ claims: [franceInfoClaim] }))
    const result = await searchFactChecks('vaccin grippe', { apiKey: KEY, fetch: fetchMock })
    expect(result.status).toBe('found')
    expect(result.status === 'found' && result.reviews[0].rating).toBe('Faux')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('languageCode')).toBe('fr')
  })

  it('répond « aucun résultat » quand l’API ne trouve rien, sans second appel dans une autre langue', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    const result = await searchFactChecks('phrase inconnue', { apiKey: KEY, fetch: fetchMock })
    expect(result).toEqual({ status: 'none' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('répond « aucun résultat » quand seuls des médias hors liste ont vérifié', async () => {
    const other = { ...franceInfoClaim, claimReview: [{ ...franceInfoClaim.claimReview[0], publisher: { name: 'X', site: 'example.com' }, url: 'https://example.com/x' }] }
    const result = await searchFactChecks('q', { apiKey: KEY, fetch: vi.fn().mockResolvedValue(jsonResponse({ claims: [other] })) })
    expect(result).toEqual({ status: 'none' })
  })

  it('distingue une panne ou un quota dépassé d’une absence de résultat', async () => {
    for (const status of [403, 429, 500]) {
      const result = await searchFactChecks('q', { apiKey: KEY, fetch: vi.fn().mockResolvedValue(jsonResponse({ error: {} }, status)) })
      expect(result.status).toBe('error')
    }
    const network = await searchFactChecks('q', { apiKey: KEY, fetch: vi.fn().mockRejectedValue(new Error('offline')) })
    expect(network.status).toBe('error')
  })

  it('ne laisse jamais la clé apparaître dans un message d’erreur', async () => {
    const result = await searchFactChecks('q', { apiKey: 'SECRET-123', fetch: vi.fn().mockRejectedValue(new Error('failed https://x?key=SECRET-123')) })
    expect(JSON.stringify(result)).not.toContain('SECRET-123')
  })
})
