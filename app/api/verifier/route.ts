import { MAX_QUERY_LENGTH, searchFactChecks, type FactCheckSearchResult } from '../../../lib/google-factcheck'

// Appel côté serveur uniquement : la clé GOOGLE_FACT_CHECK_API_KEY n'est jamais envoyée au navigateur
// (pas de préfixe NEXT_PUBLIC_) et n'apparaît dans aucune réponse.

const json = (body: FactCheckSearchResult | { status: 'error'; message: string }, status: number) =>
  Response.json(body, { status, headers: { 'Cache-Control': status === 200 ? 'public, s-maxage=3600' : 'no-store' } })

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return json({ status: 'error', message: `Saisissez une affirmation de 1 à ${MAX_QUERY_LENGTH} caractères.` }, 400)
  }

  const apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY
  if (!apiKey) {
    return json({ status: 'error', message: 'La vérification n’est pas encore configurée sur ce site.' }, 503)
  }

  const result = await searchFactChecks(query, { apiKey })
  return json(result, result.status === 'error' ? 502 : 200)
}
