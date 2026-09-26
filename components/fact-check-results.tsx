'use client'

import { useState } from 'react'
import { ChevronDown, Clipboard, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { analyzeClaim, formatLevel, formatStance, type FactCheckResult, type Evidence, VERDICTS } from '@/lib/factcheck-engine'

function Gauge({ label, score, color, icon: Icon, note }: { label: string; score: number; color: string; icon: typeof ShieldCheck; note: string }) {
  return (
    <div className="bg-[var(--sheet)] p-5 border-t-2 border-[var(--rule)]">
      <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon size={16} style={{ color }} />
        {label}
        
      </div>
      <div className="flex items-end gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--rule)]">
          <div className="h-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
        </div>
        <strong className="text-3xl font-semibold tracking-tight text-ink tabular-nums">{score}<span className="text-base font-normal text-ink-soft"> / 100</span></strong>
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
    <section id="resultats" className="max-w-4xl space-y-6" aria-live="polite">
      <div className="border border-[var(--rule)] bg-[var(--sheet)] p-6 sm:p-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm text-ink-soft">Résultat de la vérification</p>
            <h2 className="font-display text-2xl font-normal italic leading-snug text-ink sm:text-3xl">&laquo;&nbsp;{claim}&nbsp;&raquo;</h2>
          </div>
          <VerdictStamp label={verdict.label} color={verdict.color} />
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-ink-soft">{verdict.description} {result.explanation}</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {result.verdict === 'undetermined' ? (
            <div className="bg-[var(--sheet)] p-5 border-t-2 border-[var(--rule)]">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck size={16} style={{ color: '#667085' }} />
                Fiabilité
              </div>
              <p className="text-xs leading-relaxed text-ink-soft">Pas de score ici : le verdict est &laquo;&nbsp;impossible à déterminer&nbsp;&raquo;. Un chiffre laisserait croire à une mesure qui n&rsquo;existe pas.</p>
            </div>
          ) : (
            <Gauge label="Fiabilité" score={result.reliabilityScore} color="#1e6b52" icon={ShieldCheck} note="À quel point l’affirmation semble vraie d’après les sources trouvées." />
          )}
          <Gauge label="Confiance de l’analyse" score={result.confidenceScore} color="#a9781f" icon={Sparkles} note="À quel point l’analyse est solide, indépendamment du verdict." />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">{result.keywords.map((keyword) => <span key={keyword} className="rounded-full bg-[#e7e9e4] px-3 py-1 text-xs text-ink-soft">{keyword}</span>)}</div>
      </div>
      <div className="overflow-hidden border border-[var(--rule)] bg-[var(--sheet)]">
        <button type="button" onClick={() => setDetails(!details)} aria-expanded={details} className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-ink">
          <span>Voir le détail des sources ({evidence.length})</span>
          <ChevronDown size={18} className={`text-ink-soft transition-transform ${details ? 'rotate-180' : ''}`} />
        </button>
        {details && (
          <div className="overflow-x-auto border-t border-[var(--rule)]">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-[var(--paper)] text-xs text-ink-soft">
                <tr>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Niveau</th>
                  <th className="px-5 py-3 font-medium">Position</th>
                  <th className="px-5 py-3 font-medium">Impact</th>
                  <th className="px-5 py-3 font-medium">Vérifié le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {result.breakdown.map((item) => (
                  <tr key={`${item.sourceName}-${item.dateChecked}`}>
                    <td className="px-5 py-4 align-top font-medium text-ink">
                      <div>{item.sourceName}</div>
                      {item.detail && <p className="mt-1 max-w-xs text-xs font-normal leading-relaxed text-ink-soft">{item.detail}</p>}
                    </td>
                    <td className="px-5 py-4 align-top text-ink-soft">{formatLevel(item.sourceLevel)}</td>
                    <td className={`px-5 py-4 align-top font-medium ${item.stance === 'contradicts' ? 'text-[var(--false)]' : item.stance === 'supports' ? 'text-[var(--verified)]' : 'text-ink-soft'}`}>{formatStance(item.stance)}</td>
                    <td className={`px-5 py-4 tabular-nums align-top font-medium ${item.direction === 'baisse' ? 'text-[var(--false)]' : item.direction === 'hausse' ? 'text-[var(--verified)]' : 'text-ink-soft'}`}>{item.direction === 'neutre' ? 'Neutre' : `${item.direction === 'hausse' ? '+' : ''}${item.impact}`}</td>
                    <td className="px-5 py-4 align-top tabular-nums text-ink-soft">{item.dateChecked}</td>
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
    <div className="border border-[var(--rule)] bg-[#e7e9e4] p-6 sm:p-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">Partager ce résultat</h3>
          <p className="mt-1 text-sm text-ink-soft">Une carte claire, avec le verdict et ses limites.</p>
        </div>
        <Button variant="outline" size="sm" onClick={copyLink} className="border-ink text-ink hover:bg-ink hover:text-paper">
          <Clipboard size={15} />{copied ? 'Lien copié' : 'Copier le lien'}
        </Button>
      </div>
      <div className="mx-auto aspect-square max-w-[420px] border border-[var(--rule)] bg-[var(--sheet)] p-7">
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <span className="font-display">Fact Check</span>
            </div>
            <p className="font-display mt-8 line-clamp-4 text-xl italic leading-snug text-ink">&laquo;&nbsp;{claim}&nbsp;&raquo;</p>
          </div>
          <div>
            <VerdictStamp label={verdict.label} color={verdict.color} />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="bg-[var(--paper)] p-3">
                <span className="text-xs text-ink-soft">Fiabilité</span>
                {result.verdict === 'undetermined' ? (
                  <p className="mt-1 text-xs leading-snug text-ink-soft">Non mesurable</p>
                ) : (
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[#1e6b52]">{result.reliabilityScore}%</p>
                )}
              </div>
              <div className="bg-[var(--paper)] p-3">
                <span className="text-xs text-ink-soft">Confiance</span>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#a9781f]">{result.confidenceScore}%</p>
              </div>
            </div>
            <p className="mt-5 text-xs text-ink-soft">{typeof window !== 'undefined' ? window.location.host : ''} &middot; Voir l&rsquo;analyse complète <ExternalLink className="ml-1 inline" size={12} /></p>
          </div>
        </div>
      </div>
    </div>
  )
}
