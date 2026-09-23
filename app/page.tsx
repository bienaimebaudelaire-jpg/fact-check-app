'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Results } from '@/components/fact-check-results'
import { analyzeClaim, demoClaimExamples, evidenceForClaim, isDemoClaim, type Evidence, type FactCheckResult } from '@/lib/factcheck-engine'

export default function Home() {
  const [claim, setClaim] = useState('')
  const [result, setResult] = useState<FactCheckResult | null>(null)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [demoNotice, setDemoNotice] = useState(false)

  const analyze = () => {
    if (!isDemoClaim(claim)) {
      setResult(null)
      setEvidence([])
      setDemoNotice(true)
      window.setTimeout(() => document.getElementById('resultats')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      return
    }
    const found = evidenceForClaim(claim)
    setDemoNotice(false)
    setEvidence(found)
    setResult(analyzeClaim(claim, found))
    window.setTimeout(() => document.getElementById('resultats')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

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
            Collez la phrase qui vous fait douter. Fact Check la confronte aux sources disponibles et vous dit ce qu&rsquo;on sait, et ce qu&rsquo;on ne sait pas.
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
            <p className="text-sm text-ink-soft">Version 1 : analyse du texte, sans recherche web en direct.</p>
            <Button onClick={analyze} disabled={!claim.trim()} className="h-11 bg-ink px-6 text-[var(--sheet)] hover:bg-ink/85">
              <Search size={17} /> Vérifier cette affirmation
            </Button>
          </div>
        </section>

        <section className="mt-12 max-w-3xl border-t border-[var(--rule)] pt-6" aria-labelledby="exemples">
          <h2 id="exemples" className="text-sm font-semibold">Pas d&rsquo;idée ? Essayez un exemple de démonstration :</h2>
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

        {result && <div className="mt-16"><Results result={result} evidence={evidence} claim={claim} /></div>}

        {demoNotice && !result && (
          <div id="resultats" className="mt-16 max-w-3xl border-l-4 border-[var(--uncertain)] bg-[var(--sheet)] p-6 text-sm leading-7 text-ink-soft" aria-live="polite">
            <p className="mb-1 font-semibold text-ink">Cette affirmation n&rsquo;est pas encore analysable</p>
            Pour l&rsquo;instant, seuls les exemples de démonstration sont reliés à de vraies sources. Choisissez-en un ci-dessus pour voir une vérification complète.
          </div>
        )}

        <footer id="methode" className="mt-24 border-t border-[var(--rule)] pt-8">
          <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="font-display text-xl font-semibold">Comment on vérifie</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">Une hiérarchie des sources, deux mesures, aucun raccourci.</p>
            </div>
            <div className="max-w-2xl space-y-3 text-sm leading-7 text-ink-soft">
              <p><strong className="font-semibold text-ink">Sources officielles, puis institutionnelles, puis presse établie, puis fact-checkers tiers.</strong> Ce qui n&rsquo;est pas vérifiable compte en dernier.</p>
              <p>La <strong className="font-semibold text-ink">fiabilité</strong> dit dans quel sens penchent les sources. La <strong className="font-semibold text-ink">confiance</strong> dit à quel point l&rsquo;analyse est solide : nombre, diversité et fraîcheur des sources.</p>
              <p>&laquo; Impossible à déterminer &raquo; est une réponse honnête, pas un échec.</p>
            </div>
          </div>
          <p className="mt-10 text-xs text-ink-soft">Méthode publique. Données de démonstration locales en version 1.</p>
        </footer>
      </div>
    </main>
  )
}
