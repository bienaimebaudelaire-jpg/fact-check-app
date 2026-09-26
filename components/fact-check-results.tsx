'use client'

import { useState } from 'react'
import { Check, ChevronDown, Clipboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatStance, type FactCheckResult, type Evidence, type SourceLevel, VERDICTS } from '@/lib/factcheck-engine'

const levelNames: Record<SourceLevel, string> = {
  1: 'Officiel / primaire',
  2: 'Institutionnel',
  3: 'Presse ou fact-checker établi',
  4: 'Tiers spécialisé',
  5: 'Non vérifiable',
}

const stanceColor = { supports: 'var(--verified)', contradicts: 'var(--false)', neutral: 'var(--rule)' } as const

function formatDate(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function VerdictStamp({ label, color }: { label: string; color: string }) {
  return (
    <div className="stamp inline-block shrink-0 whitespace-nowrap font-display text-sm font-semibold uppercase" style={{ color, opacity: 0.92 }}>
      {label}
    </div>
  )
}

/**
 * La fiabilité dit dans quel sens penchent les sources : une balance à deux plateaux
 * (contredit / soutient) plutôt qu'une barre de progression, avec 50 au centre.
 */
function Balance({ score, color }: { score: number; color: string }) {
  const lean = score === 50 ? 'Les sources s’équilibrent.' : score > 50 ? 'Les sources penchent du côté « soutient ».' : 'Les sources penchent du côté « contredit ».'
  const from = Math.min(score, 50)
  const width = Math.abs(score - 50)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="text-sm font-semibold text-ink">Fiabilité</h4>
        <p className="tabular-nums text-ink"><strong className="text-2xl font-semibold">{score}</strong><span className="text-sm text-ink-soft"> / 100</span></p>
      </div>
      <div
        className="relative mt-4 h-8"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label="Fiabilité, de contredit (0) à soutient (100)"
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--rule)]" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 transition-all duration-700" style={{ left: `${from}%`, width: `${width}%`, backgroundColor: color }} />
        <div className="absolute left-1/2 top-1 h-6 w-px bg-ink-soft/60" aria-hidden />
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--sheet)] transition-all duration-700"
          style={{ left: `${score}%`, backgroundColor: color, boxShadow: `0 0 0 1px ${color}` }}
          aria-hidden
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-soft" aria-hidden>
        <span>Contredit</span>
        <span>Soutient</span>
      </div>
      <p className="mt-3 text-sm text-ink-soft">{lean}</p>
    </div>
  )
}

function Confidence({ score }: { score: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="text-sm font-semibold text-ink">Confiance de l’analyse</h4>
        <p className="tabular-nums text-ink"><strong className="text-2xl font-semibold">{score}</strong><span className="text-sm text-ink-soft"> / 100</span></p>
      </div>
      <div className="mt-4 h-1 bg-[var(--rule)]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="Confiance de l’analyse">
        <div className="h-full bg-ink-soft transition-all duration-700" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-3 text-sm text-ink-soft">Solidité de l’analyse : nombre, diversité et fraîcheur des sources. Elle ne dit rien du sens du verdict.</p>
    </div>
  )
}

export function Results({ result, evidence, claim }: { result: FactCheckResult; evidence: Evidence[]; claim: string }) {
  const [method, setMethod] = useState(false)
  const verdict = VERDICTS[result.verdict]
  const undetermined = result.verdict === 'undetermined'
  return (
    <section id="resultats" className="max-w-3xl" aria-live="polite">
      <div className="border border-[var(--rule)] bg-[var(--sheet)]">
        <header className="p-6 sm:p-10">
          <p className="text-sm text-ink-soft">Résultat de la vérification</p>
          <h2 className="font-display mt-2 text-2xl font-normal italic leading-snug text-ink sm:text-[2rem]">&laquo;&nbsp;{claim}&nbsp;&raquo;</h2>
          <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <VerdictStamp label={verdict.label} color={verdict.color} />
            <p className="max-w-md text-base leading-7 text-ink">{verdict.description}</p>
          </div>
        </header>

        <div className="grid gap-8 border-t border-[var(--rule)] p-6 sm:grid-cols-2 sm:gap-10 sm:p-10">
          {undetermined ? (
            <div>
              <h4 className="text-sm font-semibold text-ink">Fiabilité</h4>
              <p className="mt-3 text-sm leading-6 text-ink-soft">Pas de balance ici : le verdict est &laquo;&nbsp;impossible à déterminer&nbsp;&raquo;. Une position laisserait croire à une mesure qui n&rsquo;existe pas.</p>
            </div>
          ) : (
            <Balance score={result.reliabilityScore} color={verdict.color} />
          )}
          <Confidence score={result.confidenceScore} />
        </div>

        <div className="border-t border-[var(--rule)] p-6 sm:p-10">
          <h3 className="font-display text-lg font-semibold text-ink">Les sources ({evidence.length})</h3>
          {result.breakdown.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">Aucune source exploitable pour cette affirmation.</p>
          ) : (
            <ul className="mt-5 space-y-5">
              {result.breakdown.map((item) => (
                <li key={`${item.sourceName}-${item.dateChecked}`} className="border-l-[3px] pl-4" style={{ borderColor: stanceColor[item.stance] }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-semibold text-ink">{item.sourceName}</p>
                    <p className="text-sm font-medium" style={{ color: item.stance === 'neutral' ? 'var(--ink-soft)' : stanceColor[item.stance] }}>
                      {formatStance(item.stance)}
                      {item.direction !== 'neutre' && (
                        <span className="ml-2 tabular-nums" aria-label={`impact ${item.impact} points`}>{item.impact > 0 ? '+' : ''}{item.impact}</span>
                      )}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">{levelNames[item.sourceLevel]}, vérifié le {formatDate(item.dateChecked)}</p>
                  {item.detail && <p className="mt-2 text-sm leading-6 text-ink-soft">{item.detail}</p>}
                </li>
              ))}
            </ul>
          )}

          <button type="button" onClick={() => setMethod(!method)} aria-expanded={method} className="mt-8 flex items-center gap-1.5 text-sm font-medium text-ink underline decoration-[var(--rule)] decoration-2 underline-offset-4 hover:decoration-ink">
            <ChevronDown size={16} className={`transition-transform ${method ? 'rotate-180' : ''}`} />
            Comment ce résultat est calculé
          </button>
          {method && <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-soft">{result.explanation}</p>}
        </div>
      </div>

      <ShareRow result={result} claim={claim} />
    </section>
  )
}

function ShareRow({ result, claim }: { result: FactCheckResult; claim: string }) {
  const [copied, setCopied] = useState(false)
  const verdict = VERDICTS[result.verdict]
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
          <span className="font-semibold" style={{ color: verdict.color }}>{verdict.label}</span> : &laquo;&nbsp;{claim}&nbsp;&raquo;
        </p>
      </div>
      <Button variant="outline" onClick={copyLink} className="shrink-0 border-ink bg-transparent text-ink hover:bg-ink hover:text-[var(--sheet)]">
        {copied ? <Check size={15} /> : <Clipboard size={15} />}
        {copied ? 'Lien copié' : 'Copier le lien'}
      </Button>
    </div>
  )
}
