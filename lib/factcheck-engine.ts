export type SourceLevel = 1 | 2 | 3 | 4 | 5
export type EvidenceStance = 'supports' | 'contradicts' | 'neutral'
export type VerdictCode =
  | 'verified'
  | 'very_likely_true'
  | 'partially_true'
  | 'misleading'
  | 'very_likely_false'
  | 'false'
  | 'undetermined'

export type Evidence = {
  sourceName: string
  sourceLevel: SourceLevel
  stance: EvidenceStance
  dateChecked: string
}

export type BreakdownItem = Evidence & {
  impact: number
  direction: 'hausse' | 'baisse' | 'neutre'
}

export type FactCheckResult = {
  reliabilityScore: number
  confidenceScore: number
  verdict: VerdictCode
  explanation: string
  keywords: string[]
  breakdown: BreakdownItem[]
}

export const VERDICTS: Record<VerdictCode, { label: string; color: string; description: string }> = {
  verified: { label: 'Vérifié', color: '#18794e', description: 'Les sources fiables convergent nettement.' },
  very_likely_true: { label: 'Très probablement vrai', color: '#369c70', description: 'Les éléments disponibles soutiennent fortement l’affirmation.' },
  partially_true: { label: 'Partiellement vrai', color: '#4f8fa8', description: 'Une partie de l’affirmation est étayée, mais elle manque de précision.' },
  misleading: { label: 'Trompeur', color: '#b8862d', description: 'L’affirmation s’appuie sur un contexte incomplet ou déformé.' },
  very_likely_false: { label: 'Très probablement faux', color: '#c66b55', description: 'Les sources fiables contredisent fortement l’affirmation.' },
  false: { label: 'Faux', color: '#b43f3f', description: 'Les éléments vérifiables contredisent l’affirmation.' },
  undetermined: { label: 'Impossible à déterminer', color: '#667085', description: 'Les sources disponibles ne permettent pas de conclure.' },
}

const sourceWeight: Record<SourceLevel, number> = { 1: 1, 2: 0.86, 3: 0.7, 4: 0.48, 5: 0 }
const stanceWeight: Record<EvidenceStance, number> = { supports: 1, neutral: 0, contradicts: -1 }

function recency(dateChecked: string) {
  const age = Math.max(0, (Date.now() - new Date(dateChecked).getTime()) / 86_400_000)
  return Math.max(0.25, Math.min(1, 1 - age / 730))
}

function classify(reliability: number, evidence: Evidence[], hasConflict: boolean, independentCount: number): VerdictCode {
  // This guard is intentionally first: insufficient or conflicting high-quality evidence cannot produce a directional verdict.
  if (independentCount < 2 || hasConflict) return 'undetermined'
  if (reliability >= 90) return 'verified'
  if (reliability >= 72) return 'very_likely_true'
  if (reliability >= 54) return 'partially_true'
  if (reliability >= 43) return 'misleading'
  if (reliability >= 25) return 'very_likely_false'
  return 'false'
}

export function analyzeClaim(claim: string, evidence: Evidence[]): FactCheckResult {
  const usable = evidence.filter((item) => item.sourceLevel < 5)
  const independentCount = new Set(usable.map((item) => item.sourceName)).size
  const levelStances = new Map<SourceLevel, Set<EvidenceStance>>()
  usable.forEach((item) => {
    if (!levelStances.has(item.sourceLevel)) levelStances.set(item.sourceLevel, new Set())
    if (item.stance !== 'neutral') levelStances.get(item.sourceLevel)?.add(item.stance)
  })
  const hasConflict = [...levelStances.values()].some((stances) => stances.has('supports') && stances.has('contradicts'))
  const directional = usable.reduce((sum, item) => sum + stanceWeight[item.stance] * sourceWeight[item.sourceLevel] * recency(item.dateChecked), 0)
  const totalWeight = usable.reduce((sum, item) => sum + sourceWeight[item.sourceLevel] * recency(item.dateChecked), 0)
  const normalized = totalWeight ? directional / totalWeight : 0
  const reliabilityScore = Math.round(Math.max(0, Math.min(100, 50 + normalized * 50)))
  const distinctLevels = new Set(usable.map((item) => item.sourceLevel)).size
  const recencyAverage = usable.length ? usable.reduce((sum, item) => sum + recency(item.dateChecked), 0) / usable.length : 0
  const confidenceScore = Math.round(Math.max(0, Math.min(100, usable.length ? 25 + Math.min(35, independentCount * 12) + distinctLevels * 8 + recencyAverage * 12 : 0)))
  const breakdown = evidence.map((item) => {
    const impact = Math.round(stanceWeight[item.stance] * sourceWeight[item.sourceLevel] * 18)
    return { ...item, impact, direction: impact > 0 ? 'hausse' : impact < 0 ? 'baisse' : 'neutre' }
  })
  const verdict = classify(reliabilityScore, evidence, hasConflict, independentCount)
  const sourceWord = independentCount > 1 ? `${independentCount} sources indépendantes` : 'source indépendante'
  const explanation = verdict === 'undetermined'
    ? `L’analyse reste prudente : ${sourceWord} de niveau 1 à 3 ne suffisent pas ou se contredisent au même niveau.`
    : `Le score de fiabilité reflète l’accord pondéré de ${sourceWord}, en donnant davantage de poids aux sources primaires et récentes.`
  const keywords = [...new Set(claim.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿñæœ]{5,}/gi) ?? [])].slice(0, 5)
  return { reliabilityScore, confidenceScore, verdict, explanation, keywords: keywords.length ? keywords : ['sources', 'contexte', 'vérification'], breakdown }
}

export const evidenceForDemo: Record<string, Evidence[]> = {
  'éoliennes': [
    { sourceName: 'Ministère de la Transition écologique', sourceLevel: 1, stance: 'supports', dateChecked: '2026-08-12' },
    { sourceName: 'ADEME — données énergie', sourceLevel: 2, stance: 'supports', dateChecked: '2026-07-25' },
    { sourceName: 'INSEE', sourceLevel: 2, stance: 'neutral', dateChecked: '2026-06-30' },
  ],
  'vaccin': [
    { sourceName: 'Santé publique France', sourceLevel: 1, stance: 'contradicts', dateChecked: '2026-08-01' },
    { sourceName: 'OMS — bureau Europe', sourceLevel: 1, stance: 'contradicts', dateChecked: '2026-07-19' },
    { sourceName: 'Inserm', sourceLevel: 2, stance: 'contradicts', dateChecked: '2026-06-14' },
  ],
  'transport': [
    { sourceName: 'Ministère des Transports', sourceLevel: 1, stance: 'supports', dateChecked: '2026-04-02' },
    { sourceName: 'Cour des comptes', sourceLevel: 2, stance: 'contradicts', dateChecked: '2026-03-27' },
    { sourceName: 'Les Décodeurs', sourceLevel: 3, stance: 'supports', dateChecked: '2026-03-20' },
  ],
  'lune': [
    { sourceName: 'NASA — archives Apollo', sourceLevel: 1, stance: 'supports', dateChecked: '2025-11-04' },
    { sourceName: 'CNES', sourceLevel: 1, stance: 'supports', dateChecked: '2026-01-18' },
    { sourceName: 'Franceinfo — vérification', sourceLevel: 3, stance: 'supports', dateChecked: '2026-02-12' },
  ],
}

export function evidenceForClaim(claim: string): Evidence[] {
  const key = Object.keys(evidenceForDemo).find((candidate) => claim.toLowerCase().includes(candidate))
  return key ? evidenceForDemo[key] : []
}

export function formatStance(stance: EvidenceStance) {
  return stance === 'supports' ? 'Soutient' : stance === 'contradicts' ? 'Contredit' : 'Neutre'
}

export function formatLevel(level: SourceLevel) {
  return `${level} — ${['Officiel / primaire', 'Institutionnel', 'Presse ou fact-checker établi', 'Tiers spécialisé', 'Non vérifiable'][level - 1]}`
}
