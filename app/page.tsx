'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Info, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Results } from '@/components/fact-check-results'
import { analyzeClaim, demoClaimExamples, evidenceForClaim, isDemoClaim, type Evidence, type FactCheckResult } from '@/lib/factcheck-engine'

export default function Home() {
  const [claim, setClaim] = useState('')
  const [result, setResult] = useState<FactCheckResult | null>(null)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [demoNotice, setDemoNotice] = useState(false)
  const selectedExample = useMemo(() => demoClaimExamples.find((example) => example.text === claim), [claim])

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
      <header className="border-b border-[var(--paper-line)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center border-2 border-ink font-mono-data text-xs font-bold text-ink">FC</div>
            <span className="font-display font-semibold tracking-tight">Fact Check</span>
          </div>
          <a href="#methodologie" className="font-mono-data text-xs uppercase tracking-[.14em] text-ink-soft hover:text-ink">Notre methode</a>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-20 pt-16 lg:px-8 lg:pt-20">
        <section className="max-w-3xl">
          <div className="font-mono-data mb-6 flex items-center gap-2 text-xs uppercase tracking-[.14em] text-[var(--verified)]">
            <ShieldCheck size={15} /> Dossier ouvert &mdash; lecture calme des faits
          </div>
          <h1 className="font-display max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
            Comprendre une affirmation, sans precipitation.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-ink-soft">
            Collez une affirmation. Fact Check compare les elements disponibles et separe la fiabilite de la confiance dans l&rsquo;analyse.
          </p>

          <div className="mt-10 border border-[var(--paper-line)] bg-[#f7f5ec] p-4 sm:p-6">
            <label htmlFor="claim" className="mb-3 block text-sm font-semibold text-ink">Que souhaitez-vous verifier ?</label>
            <Textarea
              id="claim"
              value={claim}
              onChange={(event) => setClaim(event.target.value)}
              placeholder="Collez une affirmation ou un extrait..."
              className="min-h-32 resize-none border-[var(--paper-line)] bg-white/60 text-base leading-7 focus-visible:ring-ink"
            />
            <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="font-mono-data flex items-center gap-2 text-[11px] text-ink-soft">
                <Info size={13} /> V1 : analyse de texte, sans recherche web en direct
              </div>
              <Button onClick={analyze} disabled={!claim.trim()} className="bg-ink text-paper hover:bg-ink/85">
                <Search size={16} /> Analyser <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-8 border border-dashed border-[var(--paper-line)] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-mono-data text-[11px] uppercase tracking-[.14em] text-ink-soft">Exemple de demonstration</p>
              <p className="mt-1 text-sm text-ink-soft">Choisissez un cas illustratif pour voir le parcours complet.</p>
            </div>
            <div className="relative sm:w-[360px]">
              <select
                aria-label="Choisir un exemple de demonstration"
                value={selectedExample?.text ?? ''}
                onChange={(event) => setClaim(event.target.value)}
                className="w-full appearance-none border border-[var(--paper-line)] bg-white/60 px-4 py-3 pr-10 text-sm text-ink outline-none focus:ring-2 focus:ring-ink"
              >
                <option value="">Selectionner un exemple</option>
                {demoClaimExamples.map((example) => <option key={example.text} value={example.text}>{example.label}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3.5 text-ink-soft" />
            </div>
          </div>
        </section>

        {result && <div className="mt-12"><Results result={result} evidence={evidence} claim={claim} /></div>}

        {demoNotice && !result && (
          <div id="resultats" className="mt-12 border border-dashed border-[var(--paper-line)] bg-[#f7f5ec] p-6 text-sm leading-6 text-ink-soft" aria-live="polite">
            <p className="font-mono-data mb-2 text-[11px] uppercase tracking-[.14em] text-ink-soft">Démo</p>
            Seuls les exemples proposés ci-dessus sont analysés pour l&rsquo;instant : aucune source réelle n&rsquo;est encore rattachée aux autres affirmations. Choisissez un exemple pour voir un parcours complet.
          </div>
        )}

        <footer id="methodologie" className="mt-20 border-t border-[var(--paper-line)] pt-8">
          <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
            <div>
              <p className="text-sm font-semibold text-ink">Comment ce score est calcule ?</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">Une hierarchie, deux mesures, pas de raccourci.</p>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-ink-soft">
              <strong className="font-semibold text-ink">Officiel &gt; institutionnel &gt; presse etablie &gt; fact-checkers tiers &gt; non verifiable.</strong> La fiabilite mesure la direction des elements ; la confiance mesure la solidite de l&rsquo;analyse (nombre, diversite et recence des sources). &laquo; Impossible a determiner &raquo; est une issue legitime, jamais un echec.
            </p>
          </div>
          <div className="font-mono-data mt-8 flex items-center gap-2 text-[11px] text-ink-soft">
            <Check size={13} className="text-[var(--verified)]" /> Methode transparente &middot; donnees de demonstration locales en V1
          </div>
        </footer>
      </div>
    </main>
  )
}
