// Recherche de vérifications déjà publiées via l'API Google Fact Check Tools (claims:search).
// Documentation : https://developers.google.com/fact-check/tools/api/reference/rest/v1alpha1/claims/search
//
// Règles produit :
// - français uniquement (languageCode=fr), pas de repli sur une autre langue ;
// - seuls les médias publics français listés dans OFFICIAL_PUBLISHERS sont retenus ;
// - le verdict du média est repris mot pour mot (textualRating), jamais traduit ni converti ;
// - aucun résultat retenu => « aucun résultat » (l'UI affiche « Impossible à déterminer ») ;
// - une panne ou un quota dépassé est une erreur, pas une absence de résultat.

const ENDPOINT = 'https://factchecktools.googleapis.com/v1alpha1/claims:search'
const PAGE_SIZE = 50
export const MAX_QUERY_LENGTH = 500

/**
 * Médias publics français (audiovisuel public) dont on affiche les vérifications.
 * Comparaison sur le domaine de l'article de vérification (publisher.site, déduit de l'URL
 * par Google), sous-domaines inclus. Liste publique : elle est aussi affichée dans l'interface.
 */
export const OFFICIAL_PUBLISHERS: { name: string; site: string }[] = [
  { name: 'franceinfo (France Télévisions, Radio France)', site: 'francetvinfo.fr' },
  { name: 'France Télévisions', site: 'france.tv' },
  { name: 'Radio France', site: 'radiofrance.fr' },
  { name: 'France Inter', site: 'franceinter.fr' },
  { name: 'France Culture', site: 'franceculture.fr' },
  { name: 'France 24 (France Médias Monde)', site: 'france24.com' },
  { name: 'RFI (France Médias Monde)', site: 'rfi.fr' },
  { name: 'TV5Monde', site: 'tv5monde.com' },
  { name: 'Arte', site: 'arte.tv' },
  { name: 'LCP', site: 'lcp.fr' },
  { name: 'Public Sénat', site: 'publicsenat.fr' },
]

export type MediaReview = {
  /** L'affirmation que le média a réellement vérifiée (pas forcément la phrase saisie). */
  reviewedClaim: string
  claimant?: string
  publisherName: string
  publisherSite: string
  /** Verdict du média, tel quel. */
  rating: string
  reviewDate?: string
  url: string
  title?: string
}

export type FactCheckSearchResult =
  | { status: 'found'; reviews: MediaReview[] }
  | { status: 'none' }
  | { status: 'error'; message: string }

type ApiClaimReview = {
  publisher?: { name?: string; site?: string }
  url?: string
  title?: string
  reviewDate?: string
  textualRating?: string
  languageCode?: string
}

type ApiClaim = {
  text?: string
  claimant?: string
  claimDate?: string
  claimReview?: ApiClaimReview[]
}

export function buildSearchUrl(query: string, apiKey: string): string {
  const url = new URL(ENDPOINT)
  url.searchParams.set('query', query)
  url.searchParams.set('languageCode', 'fr')
  url.searchParams.set('pageSize', String(PAGE_SIZE))
  url.searchParams.set('key', apiKey)
  return url.toString()
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

export function isOfficialPublisher(site: string | undefined): boolean {
  if (!site) return false
  const host = site.toLowerCase().replace(/^www\./, '')
  return OFFICIAL_PUBLISHERS.some(({ site: allowed }) => host === allowed || host.endsWith(`.${allowed}`))
}

export function normalizeReviews(claims: ApiClaim[]): MediaReview[] {
  const byUrl = new Map<string, MediaReview>()
  for (const claim of claims) {
    for (const review of claim.claimReview ?? []) {
      const rating = review.textualRating?.trim()
      const url = review.url?.trim()
      // Sans verdict ou sans lien, on ne peut ni citer ni renvoyer vers le média : on écarte.
      if (!rating || !url || byUrl.has(url)) continue
      const site = review.publisher?.site?.trim() || hostOf(url)
      if (!site || !isOfficialPublisher(site)) continue
      byUrl.set(url, {
        reviewedClaim: claim.text?.trim() || review.title?.trim() || '',
        claimant: claim.claimant?.trim() || undefined,
        publisherName: review.publisher?.name?.trim() || site,
        publisherSite: site,
        rating,
        reviewDate: review.reviewDate || undefined,
        url,
        title: review.title?.trim() || undefined,
      })
    }
  }
  const time = (r: MediaReview) => (r.reviewDate ? Date.parse(r.reviewDate) || 0 : 0)
  return [...byUrl.values()].sort((a, b) => time(b) - time(a))
}

export async function searchFactChecks(
  query: string,
  { apiKey, fetch: fetchImpl = fetch }: { apiKey: string; fetch?: typeof fetch },
): Promise<FactCheckSearchResult> {
  let response: Response
  try {
    response = await fetchImpl(buildSearchUrl(query, apiKey), { headers: { Accept: 'application/json' } })
  } catch {
    // Le message d'origine peut contenir l'URL, donc la clé : on ne le propage pas.
    return { status: 'error', message: 'Le service de vérification est injoignable.' }
  }
  if (!response.ok) {
    const message = response.status === 429
      ? 'Trop de demandes pour le moment. Réessayez dans quelques minutes.'
      : 'Le service de vérification a refusé la demande.'
    return { status: 'error', message }
  }
  const body = (await response.json().catch(() => ({}))) as { claims?: ApiClaim[] }
  const reviews = normalizeReviews(body.claims ?? [])
  return reviews.length ? { status: 'found', reviews } : { status: 'none' }
}
