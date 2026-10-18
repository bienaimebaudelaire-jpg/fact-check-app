import { describe, expect, it } from 'vitest'
import {
  createLearningStore,
  deriveMemory,
  evaluateScenario,
  evaluationSummary,
  ingestEvent,
  realTrafficMetrics,
  registerUser,
  retrieveMemory,
  startSession,
} from './learning-memory'

function flow(store: ReturnType<typeof createLearningStore>, kind: 'real' | 'synthetic' | 'test', helpful: boolean) {
  const user = registerUser(store, kind)
  const session = startSession(store, user.id, kind)
  ingestEvent(store, { sessionId: session.id, type: 'claim_submitted', payload: { claim: 'La Terre est ronde' } })
  ingestEvent(store, { sessionId: session.id, type: 'feedback', payload: { helpful } })
  return { user, session }
}

describe('learning-memory', () => {
  it('refuse une session réelle pour un utilisateur synthétique', () => {
    const store = createLearningStore()
    const user = registerUser(store, 'synthetic')
    expect(() => startSession(store, user.id, 'real')).toThrow()
  })

  it("fige l'origine des événements et sépare la mémoire par origine", () => {
    const store = createLearningStore()
    const real = flow(store, 'real', true)
    const syn = flow(store, 'synthetic', false)
    expect(store.events.filter((e) => e.origin === 'synthetic')).toHaveLength(2)
    const realMem = deriveMemory(store, real.session.id)
    const synMem = deriveMemory(store, syn.session.id)
    expect(realMem[0].origin).toBe('real')
    expect(synMem[0].origin).toBe('synthetic')
    expect(synMem[0].confidence).toBeLessThan(realMem[0].confidence)
    expect(retrieveMemory(store)).toEqual(realMem)
    expect(retrieveMemory(store, ['synthetic'])).toEqual(synMem)
    expect(deriveMemory(store, real.session.id)).toHaveLength(0)
  })

  it('ne produit pas de mémoire sans signal explicite', () => {
    const store = createLearningStore()
    const user = registerUser(store, 'real')
    const s = startSession(store, user.id, 'real')
    ingestEvent(store, { sessionId: s.id, type: 'claim_submitted', payload: { claim: 'x' } })
    expect(deriveMemory(store, s.id)).toEqual([])
  })

  it('garde les évaluations synthétiques hors des métriques réelles', () => {
    const store = createLearningStore()
    flow(store, 'real', true)
    flow(store, 'synthetic', false)
    evaluateScenario(store, { scenario: 's1', expected: 'false', actual: 'false', origin: 'synthetic' })
    evaluateScenario(store, { scenario: 's2', expected: 'true', actual: 'false', origin: 'test' })
    expect(() => evaluateScenario(store, { scenario: 's', expected: 'a', actual: 'a', origin: 'real' })).toThrow()
    const summary = evaluationSummary(store)
    expect(summary.synthetic.meanScore).toBe(1)
    expect(summary.test.meanScore).toBe(0)
    expect(summary.real.meanScore).toBeNull()
    expect(realTrafficMetrics(store)).toEqual({ events: 2, feedbackCount: 1, helpfulRate: 1 })
  })
})
