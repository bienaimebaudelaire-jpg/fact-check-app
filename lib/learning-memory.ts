// Fondation « utilisateurs synthétiques + mémoire d'apprentissage ».
// Principe : tout est étiqueté `real | synthetic | test` dès la création et les flux ne se mélangent
// jamais. Les artefacts synthétiques/test ne comptent jamais dans les métriques « réelles ».
// Stockage en mémoire uniquement (aucune base externe). Aucune donnée n'est inventée ici.

export type Origin = 'real' | 'synthetic' | 'test'
export type UserKind = Origin
export type SessionMode = Origin

export const ORIGINS: readonly Origin[] = ['real', 'synthetic', 'test']

export type LearningUser = { id: string; kind: UserKind; source?: string; createdAt: string }

export type LearningSession = {
  id: string
  userId: string
  app: 'factcheck'
  mode: SessionMode
  startedAt: string
}

export type InteractionEventType = 'claim_submitted' | 'result_shown' | 'feedback' | 'correction'

export type InteractionEvent = {
  id: string
  sessionId: string
  type: InteractionEventType
  payload: Record<string, unknown>
  createdAt: string
  /** Copie de session.mode, figée à l'ingestion pour qu'un événement ne puisse pas être « requalifié ». */
  origin: Origin
}

export type MemoryItem = {
  id: string
  userId: string
  content: string
  /** 0..1 */
  confidence: number
  origin: Origin
  provenance: { eventIds: string[]; derivedBy: 'learning-memory/v1' }
  createdAt: string
}

export type EvaluationRecord = {
  id: string
  scenario: string
  expected: string
  actual: string
  /** 0..1 */
  score: number
  origin: Origin
  createdAt: string
}

export type LearningStore = {
  users: Map<string, LearningUser>
  sessions: Map<string, LearningSession>
  events: InteractionEvent[]
  memory: MemoryItem[]
  evaluations: EvaluationRecord[]
}

export function createLearningStore(): LearningStore {
  return { users: new Map(), sessions: new Map(), events: [], memory: [], evaluations: [] }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
let counter = 0
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`

/** Libellé lisible à afficher dans toute interface : un synthétique ne passe jamais pour un humain. */
export function originLabel(origin: Origin): string {
  return origin === 'real' ? 'Utilisateur réel' : origin === 'synthetic' ? 'SYNTHÉTIQUE (simulé)' : 'TEST'
}

export function registerUser(store: LearningStore, kind: UserKind, source?: string, now = new Date().toISOString()): LearningUser {
  if (!ORIGINS.includes(kind)) throw new Error(`Type d'utilisateur invalide : ${String(kind)}`)
  const user = { id: newId(kind), kind, source, createdAt: now }
  store.users.set(user.id, user)
  return user
}

/** Le mode de session doit être celui de l'utilisateur : pas de session « réelle » pour un agent simulé. */
export function startSession(store: LearningStore, userId: string, mode: SessionMode, now = new Date().toISOString()): LearningSession {
  const user = store.users.get(userId)
  if (!user) throw new Error('Utilisateur inconnu')
  if (user.kind !== mode) throw new Error(`Mode de session « ${mode} » incompatible avec l'utilisateur « ${user.kind} »`)
  const session: LearningSession = { id: newId('session'), userId, app: 'factcheck', mode, startedAt: now }
  store.sessions.set(session.id, session)
  return session
}

export function ingestEvent(
  store: LearningStore,
  input: { sessionId: string; type: InteractionEventType; payload?: Record<string, unknown>; createdAt?: string },
): InteractionEvent {
  const session = store.sessions.get(input.sessionId)
  if (!session) throw new Error('Session inconnue')
  const event: InteractionEvent = {
    id: newId('event'),
    sessionId: session.id,
    type: input.type,
    payload: input.payload ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
    origin: session.mode,
  }
  store.events.push(event)
  return event
}

/**
 * Dérive des éléments de mémoire à partir des événements d'une session.
 * Seuls les retours explicites (feedback / correction) produisent de la mémoire : pas de signal, pas de mémoire.
 */
export function deriveMemory(store: LearningStore, sessionId: string, now = new Date().toISOString()): MemoryItem[] {
  const session = store.sessions.get(sessionId)
  if (!session) throw new Error('Session inconnue')
  const events = store.events.filter((e) => e.sessionId === sessionId)
  const lastClaim = [...events].reverse().find((e) => e.type === 'claim_submitted')
  const claim = typeof lastClaim?.payload.claim === 'string' ? lastClaim.payload.claim : undefined
  const created: MemoryItem[] = []

  for (const event of events) {
    if (!claim || (event.type !== 'feedback' && event.type !== 'correction')) continue
    const helpful = event.type === 'feedback' && event.payload.helpful === true
    const content =
      event.type === 'correction' && typeof event.payload.correction === 'string'
        ? `Correction utilisateur sur « ${claim} » : ${event.payload.correction}`
        : `Résultat jugé ${helpful ? 'utile' : 'non utile'} pour « ${claim} »`
    if (store.memory.some((m) => m.provenance.eventIds.includes(event.id))) continue
    const item: MemoryItem = {
      id: newId('memory'),
      userId: session.userId,
      content,
      // Une correction humaine pèse plus qu'un simple « utile ». Les données non réelles restent plafonnées.
      confidence: clamp01((event.type === 'correction' ? 0.8 : 0.6) * (session.mode === 'real' ? 1 : 0.5)),
      origin: session.mode,
      provenance: { eventIds: [lastClaim!.id, event.id], derivedBy: 'learning-memory/v1' },
      createdAt: now,
    }
    store.memory.push(item)
    created.push(item)
  }
  return created
}

/** Récupération : par défaut uniquement la mémoire réelle ; le reste doit être demandé explicitement. */
export function retrieveMemory(store: LearningStore, origins: Origin[] = ['real'], minConfidence = 0): MemoryItem[] {
  return store.memory.filter((m) => origins.includes(m.origin) && m.confidence >= minConfidence)
}

/** Score 1 si le verdict obtenu est celui attendu, sinon 0. Jamais de score inventé. */
export function evaluateScenario(
  store: LearningStore,
  input: { scenario: string; expected: string; actual: string; origin: Origin },
  now = new Date().toISOString(),
): EvaluationRecord {
  if (input.origin === 'real') throw new Error('Une évaluation de scénario doit être « synthetic » ou « test »')
  const record: EvaluationRecord = {
    id: newId('eval'),
    scenario: input.scenario,
    expected: input.expected,
    actual: input.actual,
    score: input.expected === input.actual ? 1 : 0,
    origin: input.origin,
    createdAt: now,
  }
  store.evaluations.push(record)
  return record
}

/** Métriques calculées par origine, sans jamais agréger les origines entre elles. */
export function evaluationSummary(store: LearningStore): Record<Origin, { count: number; meanScore: number | null }> {
  const out = {} as Record<Origin, { count: number; meanScore: number | null }>
  for (const origin of ORIGINS) {
    const rows = store.evaluations.filter((e) => e.origin === origin)
    out[origin] = {
      count: rows.length,
      meanScore: rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : null,
    }
  }
  return out
}

/** Métriques produit : exclusivement le trafic réel. */
export function realTrafficMetrics(store: LearningStore) {
  const real = store.events.filter((e) => e.origin === 'real')
  const feedback = real.filter((e) => e.type === 'feedback')
  const helpful = feedback.filter((e) => e.payload.helpful === true).length
  return {
    events: real.length,
    feedbackCount: feedback.length,
    helpfulRate: feedback.length ? helpful / feedback.length : null,
  }
}
