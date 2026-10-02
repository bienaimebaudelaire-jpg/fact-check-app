import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { MAX_QUERY_LENGTH } from '../../../lib/google-factcheck'

const call = (q?: string) => GET(new Request(`http://localhost/api/verifier${q === undefined ? '' : `?q=${encodeURIComponent(q)}`}`))

describe('GET /api/verifier', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_FACT_CHECK_API_KEY', 'SECRET-KEY')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('refuse une phrase vide ou trop longue sans appeler l’API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await call()).status).toBe(400)
    expect((await call('   ')).status).toBe(400)
    expect((await call('a'.repeat(MAX_QUERY_LENGTH + 1))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('répond 503 avec un message clair quand la clé n’est pas configurée', async () => {
    vi.stubEnv('GOOGLE_FACT_CHECK_API_KEY', '')
    const response = await call('vaccin')
    expect(response.status).toBe(503)
    expect((await response.json()).status).toBe('error')
  })

  it('transmet le résultat sans jamais renvoyer la clé au navigateur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })))
    const response = await call('phrase inconnue')
    const text = await response.text()
    expect(response.status).toBe(200)
    expect(JSON.parse(text)).toEqual({ status: 'none' })
    expect(text).not.toContain('SECRET-KEY')
  })

  it('répond 502 quand l’API Google échoue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })))
    const response = await call('vaccin')
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('SECRET-KEY')
  })
})
