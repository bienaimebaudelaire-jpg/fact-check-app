'use client'

import { useState } from 'react'
import { ArrowUpRight, Check, Clipboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VERDICTS } from '@/lib/factcheck-engine'
import type { FactCheckSearchResult, MediaReview } from '@/lib/google-factcheck'

function formatDate(iso?: string) {
  if (!iso) return undefined
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function VerdictStamp({ label, color }: { label: string; color: string }) {
  return (
    <div className="stamp inline-block shrink-0 whitespace-nowrap font-display text-sm font-semibold uppercase" style={{ color, opacity: 0.92 }}>
      {label}
    </div>
  )
}

function Review({ review }: { review: MediaReview }) {
  const date = formatDate(review.reviewDate)
  return (
    <li className="border-l-[3px] border-ink pl-4">
      {review.reviewedClaim && (
        <p className="font-display text-lg italic leading-snug text-ink">&laquo;&nbsp;{review.reviewedClaim}&nbsp;&raquo;</p>
      )}
      {review.claimant && <p className="mt-1 text-xs text-ink-soft">Affirmation attribuée à {review.claimant}</p>}
      <p className="mt-3 text-sm text-ink">
        <span className="font-semibold">{review.publisherName}</span>
        <span className="text-ink-soft"> — verdict du média : </span>
        <strong className="font-semibold">{review.rating}</strong>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
        {date ? <span>Publié le {date}</span> : <span>Date non indiquée</span>}
        <a href={review.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-ink underline decoration-[var(--rule)] decoration-2 underline-offset-4 hover:decoration-ink">
          Lire la vérification sur {review.publisherSite}
          <ArrowUpRight size={14} aria-hidden />
        </a>
      </p>
    </li>
  )
}

export function Results({ claim, result, loading }: { claim: string; result: FactCheckSearchResult | null; loading: boolean }) {
  const undetermined = VERDICTS.undetermined
  return (
    <section id="resultats" className="max-w-3xl" aria-live="polite" aria-busy={loading}>
      <div className="border border-[var(--rule)] bg-[var(--sheet)]">
        <header className="p-6 sm:p-10">
          <p className="text-sm text-ink-soft">Résultat de la vérification</p>
          <h2 className="font-display mt-2 text-2xl font-normal italic leading-snug text-ink sm:text-[2rem]">&laquo;&nbsp;{claim}&nbsp;&raquo;</h2>

          {loading && <p className="mt-7 text-base text-ink-soft">Recherche des vérifications publiées…</p>}

          {!loading && result?.status === 'none' && (
            <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              <VerdictStamp label={undetermined.label} color={undetermined.color} />
              <p className="max-w-md text-base leading-7 text-ink">Aucun média public français n&rsquo;a publié de vérification sur ce sujet. Fact Check ne donne pas de verdict à sa place.</p>
            </div>
          )}

          {!loading && result?.status === 'error' && (
            <div className="mt-7 border-l-4 border-[var(--uncertain)] pl-4">
              <p className="font-semibold text-ink">Vérification indisponible pour le moment</p>
              <p className="mt-1 text-sm leading-6 text-ink-soft">{result.message} Ce n&rsquo;est pas un verdict : réessayez plus tard.</p>
            </div>
          )}

          {!loading && result?.status === 'found' && (
            <p className="mt-7 max-w-xl text-base leading-7 text-ink">
              {result.reviews.length === 1
                ? 'Un média public a vérifié une affirmation proche. '
                : `${result.reviews.length} vérifications de médias publics portent sur des affirmations proches. `}
              Chaque verdict ci-dessous concerne l&rsquo;affirmation citée au-dessus de lui, pas forcément votre phrase mot pour mot.
            </p>
          )}
        </header>

        {!loading && result?.status === 'found' && (
          <div className="border-t border-[var(--rule)] p-6 sm:p-10">
            <h3 className="font-display text-lg font-semibold text-ink">Vérifications publiées ({result.reviews.length})</h3>
            <ul className="mt-5 space-y-7">
              {result.reviews.map((review) => <Review key={review.url} review={review} />)}
            </ul>
          </div>
        )}
      </div>

      {!loading && result && result.status !== 'error' && <ShareRow claim={claim} result={result} />}
    </section>
  )
}

function ShareRow({ claim, result }: { claim: string; result: Extract<FactCheckSearchResult, { status: 'found' | 'none' }> }) {
  const [copied, setCopied] = useState(false)
  const summary = result.status === 'found'
    ? `${result.reviews.length} vérification${result.reviews.length > 1 ? 's' : ''} publiée${result.reviews.length > 1 ? 's' : ''}`
    : VERDICTS.undetermined.label
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="mt-6 flex flex-col gap-5 border border-[var(--rule)] bg-[#e7e9e4] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <h3 className="font-display text-lg font-semibold text-ink">Partager ce résultat</h3>
        <p className="mt-1 truncate text-sm text-ink-soft">
          <span className="font-semibold text-ink">{summary}</span> : &laquo;&nbsp;{claim}&nbsp;&raquo;
        </p>
      </div>
      <Button variant="outline" onClick={copyLink} className="shrink-0 border-ink bg-transparent text-ink hover:bg-ink hover:text-[var(--sheet)]">
        {copied ? <Check size={15} /> : <Clipboard size={15} />}
        {copied ? 'Lien copié' : 'Copier le lien'}
      </Button>
    </div>
  )
}
