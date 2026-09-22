'use client'

import { useState } from 'react'
import { ChevronDown, Clipboard, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { analyzeClaim, formatLevel, formatStance, type FactCheckResult, type Evidence, VERDICTS } from '@/lib/factcheck-engine'

function Gauge({ label, score, color, icon: Icon, note }: { label: string; score: number; color: string; icon: typeof ShieldCheck; note: string }) {
  return (
    <div className="border border-[var(--paper-line)] bg-[#f7f5ec] p-5">
      <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon size={16} style={{ color }} />
        {label}
        <span className="font-mono-data ml-auto text-[11px] font-normal text-ink-soft">/ 100</span>
      </div>
      <div className="flex items-end gap-3">
        <div className="h-2 flex-1 overflow-hidden bg-[var(--paper-line)]">
          <div className="h-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
        </div>
        <strong className="font-mono-data text-2xl tracking-tight text-ink">{score}%</strong>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-soft">{note}</p>
    </div>
  )
}

function VerdictStamp({ label, color }: { label: string; color: string }) {
  return (
    <div className="stamp inline-block font-display text-sm font-semibold uppercase" style={{ color, opacity: 0.92 }}>
      {label}
    </div>
  )
}

export function Results({ result, evidence, claim }: { result: FactCheckResult; evidence: Evidence[]; claim: string }) {
  const [details, setDetails] = useState(false)
  const verdict = VERDICTS[result.verdict]
  return (
    <section id="resultats" className="space-y-5" aria-live="polite">
      <div className="border border-[var(--paper-line)] bg-[#f7f5ec] p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono-data mb-2 text-[11px] uppercase tracking-[.18em] text-ink-soft">Dossier &mdash; resultat de l&rsquo;analyse</p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{claim}</h2>
          </div>
          <VerdictStamp label={verdict.label} color={verdict.color} />
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-ink-soft">{verdict.description} {result.explanation}</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {result.verdict === 'undetermined' ? (
            <div className="border border-[var(--paper-line)] bg-[#f7f5ec] p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck size={16} style={{ color: '#667085' }} />
                Fiabilite
              </div>
              <p className="text-xs leading-relaxed text-ink-soft">Aucun score n&rsquo;est affiche : le verdict est &laquo; impossible a determiner &raquo;, un chiffre ici laisserait croire a une mesure qui n&rsquo;existe pas.</p>
            </div>
          ) : (
            <Gauge label="Fiabilite" score={result.reliabilityScore} color="#1e6b52" icon={ShieldCheck} note="A quel point l&rsquo;affirmation semble vraie selon les elements trouves." />
          )}
          <Gauge label="Confiance de l&rsquo;analyse" score={result.confidenceScore} color="#a9781f" icon={Sparkles} note="A quel point le systeme est certain de son analyse, independamment du verdict." />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">{result.keywords.map((keyword) => <span key={keyword} className="font-mono-data border border-[var(--paper-line)] px-3 py-1.5 text-[11px] text-ink-soft">{keyword}</span>)}</div>
      </div>
      <div className="overflow-hidden border border-[var(--paper-line)] bg-[#f7f5ec]">
        <button type="button" onClick={() => setDetails(!details)} className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-ink">
          <span>Voir le detail des sources ({evidence.length})</span>
          <ChevronDown size={18} className={`text-ink-soft transition-transform ${details ? 'rotate-180' : ''}`} />
        </button>
        {details && (
          <div className="overflow-x-auto border-t border-[var(--paper-line)]">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="font-mono-data bg-[#efece2] text-[11px] uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Niveau</th>
                  <th className="px-5 py-3 font-medium">Position</th>
                  <th className="px-5 py-3 font-medium">Impact</th>
                  <th className="px-5 py-3 font-medium">Verifie le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--paper-line)]">
                {result.breakdown.map((item) => (
                  <tr key={`${item.sourceName}-${item.dateChecked}`}>
                    <td className="px-5 py-4 align-top font-medium text-ink">
                      <div>{item.sourceName}</div>
                      {item.detail && <p className="mt-1 max-w-xs text-xs font-normal leading-relaxed text-ink-soft">{item.detail}</p>}
                    </td>
                    <td className="px-5 py-4 align-top text-ink-soft">{formatLevel(item.sourceLevel)}</td>
                    <td className={`px-5 py-4 align-top font-medium ${item.stance === 'contradicts' ? 'text-[var(--false)]' : 'text-[var(--verified)]'}`}>{formatStance(item.stance)}</td>
                    <td className={`font-mono-data px-5 py-4 align-top font-medium ${item.direction === 'baisse' ? 'text-[var(--false)]' : item.direction === 'hausse' ? 'text-[var(--verified)]' : 'text-ink-soft'}`}>{item.direction === 'neutre' ? 'Neutre' : `${item.direction === 'hausse' ? '+' : ''}${item.impact}`}</td>
                    <td className="font-mono-data px-5 py-4 align-top text-ink-soft">{item.dateChecked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ShareCard result={result} claim={claim} />
    </section>
  )
}

function ShareCard({ result, claim }: { result: FactCheckResult; claim: string }) {
  const [copied, setCopied] = useState(false)
  const verdict = VERDICTS[result.verdict]
  const copyLink = async () => { await navigator.clipboard?.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
  return (
    <div className="border border-[var(--paper-line)] bg-[#e4dfd0] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono-data text-[11px] uppercase tracking-[.18em] text-ink-soft">Carte de partage</p>
          <h3 className="font-display mt-1 text-lg font-semibold text-ink">A partager en toute confiance</h3>
        </div>
        <Button variant="outline" size="sm" onClick={copyLink} className="border-ink text-ink hover:bg-ink hover:text-paper">
          <Clipboard size={15} />{copied ? 'Lien copie' : 'Copier le lien'}
        </Button>
      </div>
      <div className="mx-auto aspect-square max-w-[420px] border-2 border-ink bg-[#f7f5ec] p-7">
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <span className="grid h-7 w-7 place-items-center border-2 border-ink font-mono-data text-xs text-ink">FC</span> Fact Check
            </div>
            <p className="font-display mt-10 line-clamp-4 text-xl font-semibold leading-snug text-ink">{claim}</p>
          </div>
          <div>
            <VerdictStamp label={verdict.label} color={verdict.color} />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="border border-[var(--paper-line)] bg-white/60 p-3">
                <span className="text-[11px] text-ink-soft">Fiabilite</span>
                {result.verdict === 'undetermined' ? (
                  <p className="mt-1 text-xs leading-snug text-ink-soft">Non mesurable</p>
                ) : (
                  <p className="font-mono-data mt-1 text-2xl font-semibold text-[#1e6b52]">{result.reliabilityScore}%</p>
                )}
              </div>
              <div className="border border-[var(--paper-line)] bg-white/60 p-3">
                <span className="text-[11px] text-ink-soft">Confiance</span>
                <p className="font-mono-data mt-1 text-2xl font-semibold text-[#a9781f]">{result.confidenceScore}%</p>
              </div>
            </div>
            <p className="mt-5 text-xs text-ink-soft">fact-check.app &middot; Voir l&rsquo;analyse complete <ExternalLink className="ml-1 inline" size={12} /></p>
          </div>
        </div>
      </div>
    </div>
  )
}
