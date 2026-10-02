'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Results } from '@/components/fact-check-results'
import { demoClaimExamples } from '@/lib/factcheck-engine'
import { OFFICIAL_PUBLISHERS, type FactCheckSearchResult } from '@/lib/google-factcheck'

export default function Home() {
  const [claim, setClaim] = useState('')
  // Texte réellement analysé : le résultat affiché doit toujours citer cette phrase,
  // jamais le contenu courant du champ (sinon modifier le champ réécrit la citation
  // sous un verdict qui ne la concerne pas).
  const [analyzedClaim, setAnalyzedClaim] = useState('')
  const [result, setResult] = useState<FactCheckSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  // Seule la dernière demande a le droit d'afficher son résultat (réponses dans le désordre).
  const latestRequest = useRef(0)

  const analyze = async (text: string = claim, scroll = true) => {
    const query = text.trim()
    if (!query) return
    const url = new URL(window.location.href)
    url.searchParams.set('q', query)
    window.history.replaceState(null, '', url)
    const requestId = ++latestRequest.current
    setAnalyzedClaim(query)
    setResult(null)
    setLoading(true)
    if (scroll) window.setTimeout(() => document.getElementById('resultats')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    let next: FactCheckSearchResult
    try {
      const response = await fetch(`/api/verifier?q=${encodeURIComponent(query)}`)
      next = (await response.json()) as FactCheckSearchResult
    } catch {
      next = { status: 'error', message: 'Le service de vérification est injoignable.' }
    }
    if (requestId !== latestRequest.current) return
    setResult(next)
    setLoading(false)
  }

  // Lien partagé (?q=...) : rejouer l'analyse à l'ouverture.
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get('q')?.trim()
    if (!shared) return
    setClaim(shared)
    analyze(shared, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="min-h-screen text-ink">
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 lg:px-8">
          <span className="font-display text-lg font-semibold tracking-tight">Fact Check</span>
          <a href="#methode" className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">Notre méthode</a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-24 pt-14 lg:px-8 lg:pt-20">
        <section className="max-w-3xl">
          <h1 className="font-display text-[2.5rem] font-semibold leading-[1.1] tracking-tight sm:text-[3.25rem]">
            Vous avez lu quelque chose.<br />Vérifions-le ensemble.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">
            Collez la phrase qui vous fait douter. Fact Check cherche si les médias publics français l&rsquo;ont déjà vérifiée, et vous montre leur verdict avec le lien vers l&rsquo;article.
          </p>

          <div className="quote-frame mt-14 px-6 sm:px-12">
            <label htmlFor="claim" className="sr-only">Affirmation à vérifier</label>
            <textarea
              id="claim"
              value={claim}
              onChange={(event) => setClaim(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && claim.trim()) analyze() }}
              placeholder="Par exemple : les éoliennes consomment plus d’énergie qu’elles n’en produisent"
              rows={3}
              className="font-display block w-full resize-none border-0 border-b-2 border-[var(--rule)] bg-transparent px-0 pb-3 text-2xl leading-snug text-ink outline-none placeholder:text-[#9aa1ac] focus:border-ink sm:text-[1.75rem]"
            />
          </div>

          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-soft">Recherche en français dans les vérifications publiées.</p>
            <Button onClick={() => analyze()} disabled={!claim.trim() || loading} className="h-11 bg-ink px-6 text-[var(--sheet)] hover:bg-ink/85">
              <Search size={17} /> {loading ? 'Recherche en cours…' : 'Vérifier cette affirmation'}
            </Button>
          </div>
        </section>

        <section className="mt-12 max-w-3xl border-t border-[var(--rule)] pt-6" aria-labelledby="exemples">
          <h2 id="exemples" className="text-sm font-semibold">Pas d&rsquo;idée ? Essayez un exemple :</h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {demoClaimExamples.map((example) => (
              <li key={example.text}>
                <button
                  type="button"
                  onClick={() => setClaim(example.text)}
                  aria-pressed={claim === example.text}
                  className={`text-left text-sm underline decoration-[var(--rule)] decoration-2 underline-offset-4 hover:decoration-ink ${claim === example.text ? 'text-ink decoration-ink' : 'text-ink-soft'}`}
                >
                  {example.label}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {(loading || result) && (
          <div className="mt-16">
            <Results claim={analyzedClaim} result={result} loading={loading} />
          </div>
        )}

        <footer id="methode" className="mt-24 border-t border-[var(--rule)] pt-8">
          <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="font-display text-xl font-semibold">Comment on vérifie</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">Des vérifications publiées, recopiées sans retouche.</p>
            </div>
            <div className="max-w-2xl space-y-3 text-sm leading-7 text-ink-soft">
              <p>Fact Check interroge l&rsquo;outil de recherche de vérifications de Google (Fact Check Tools), en français, et ne retient que les <strong className="font-semibold text-ink">médias publics français</strong> : {OFFICIAL_PUBLISHERS.map((p) => p.name).join(', ')}.</p>
              <p>Chaque verdict est celui du média, <strong className="font-semibold text-ink">recopié tel quel</strong>, à côté de l&rsquo;affirmation qu&rsquo;il a réellement vérifiée, qui peut être différente de votre phrase. Fact Check n&rsquo;ajoute aucun verdict de son côté.</p>
              <p>Si aucun de ces médias n&rsquo;a vérifié le sujet, la réponse est &laquo;&nbsp;Impossible à déterminer&nbsp;&raquo;. C&rsquo;est une réponse honnête, pas un échec.</p>
            </div>
          </div>
          <p className="mt-10 text-xs text-ink-soft">Méthode publique. Liste des médias retenus dans <code>lib/google-factcheck.ts</code>.</p>
        </footer>
      </div>
    </main>
  )
}
