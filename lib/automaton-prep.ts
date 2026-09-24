import {
  analyzeClaim,
  evidenceForClaim,
  isDemoClaim,
  type Evidence,
  type FactCheckResult,
  type VerdictCode,
} from './factcheck-engine'

export type HumanValidationStatus = 'required' | 'approved' | 'rejected'

export type AgentWarningCode = 'MOCK_EVIDENCE' | 'CONNECTOR_REQUIRED' | 'HUMAN_APPROVAL_REQUIRED'

export type AgentWarning = {
  code: AgentWarningCode
  message: string
  field?: string
}

export type EvidenceProvenance = {
  provider: 'local-demo-dataset' | 'external-connector'
  retrievalMode: 'local_mock' | 'connector_live' | 'connector_required'
  collectedAt: string
  connectorConfigured: boolean
  note: string
  sourceUrl?: string
  retrievalTraceId?: string
  retrievedByConnector?: string
}

export type PreparedEvidence = Evidence & {
  mocked: boolean
  requiresConnectorFields: string[]
  provenance: EvidenceProvenance
}

export type FactCheckAgentRequest = {
  claim: string
  requestedAt?: string
  requestedBy?: string
  runtime: 'automaton-prep'
}

export type HumanValidationGate = {
  status: HumanValidationStatus
  approver?: string
  approvedAt?: string
  note?: string
}

export type FactCheckProposal = {
  request: FactCheckAgentRequest
  evidence: PreparedEvidence[]
  analysis: FactCheckResult
  warnings: AgentWarning[]
  finalVerdictAuthority: 'human_only'
  publication: {
    allowed: boolean
    reason: string
  }
  validation: HumanValidationGate
}

export type ConnectorEvidenceInput = Evidence & {
  sourceUrl: string
  retrievalTraceId: string
  retrievedByConnector: string
}

const CONNECTOR_REQUIRED_FIELDS = ['sourceUrl', 'retrievalTraceId', 'retrievedByConnector'] as const

function hasConnectorRequirement(proposal: FactCheckProposal): boolean {
  return proposal.warnings.some((warning) => warning.code === 'CONNECTOR_REQUIRED')
}

function hasMockEvidence(proposal: FactCheckProposal): boolean {
  return (
    proposal.warnings.some((warning) => warning.code === 'MOCK_EVIDENCE') ||
    proposal.evidence.some((item) => item.mocked || item.provenance.retrievalMode === 'local_mock')
  )
}

export function prepareFactCheckProposal(
  request: FactCheckAgentRequest,
  options?: { collectedAt?: string },
): FactCheckProposal {
  const collectedAt = options?.collectedAt ?? request.requestedAt ?? new Date().toISOString()
  const demoClaim = isDemoClaim(request.claim)
  const rawEvidence = demoClaim ? evidenceForClaim(request.claim) : []

  const evidence: PreparedEvidence[] = rawEvidence.map((item) => ({
    ...item,
    mocked: true,
    requiresConnectorFields: [...CONNECTOR_REQUIRED_FIELDS],
    provenance: {
      provider: 'local-demo-dataset',
      retrievalMode: 'local_mock',
      collectedAt,
      connectorConfigured: false,
      note: 'Preuve mockée de démonstration : aucune collecte réseau réelle n’a été effectuée.',
    },
  }))

  const warnings: AgentWarning[] = [
    {
      code: 'HUMAN_APPROVAL_REQUIRED',
      message: 'Verdict final et publication soumis à validation humaine explicite.',
    },
  ]

  if (demoClaim) {
    warnings.push({
      code: 'MOCK_EVIDENCE',
      message: 'Les preuves proviennent d’un jeu de démonstration local et ne représentent pas une collecte réelle.',
    })
  } else {
    warnings.push(
      {
        code: 'CONNECTOR_REQUIRED',
        field: 'evidence',
        message: 'Aucune preuve collectée : un connecteur réel est requis pour préparer une vérification exploitable.',
      },
      {
        code: 'CONNECTOR_REQUIRED',
        field: 'provenance',
        message: `Champs requis côté connecteur : ${CONNECTOR_REQUIRED_FIELDS.join(', ')}.`,
      },
    )
  }

  return {
    request,
    evidence,
    analysis: analyzeClaim(request.claim, rawEvidence),
    warnings,
    finalVerdictAuthority: 'human_only',
    publication: {
      allowed: false,
      reason: 'Publication bloquée tant que la validation humaine est absente.',
    },
    validation: {
      status: 'required',
    },
  }
}

export function approveProposal(proposal: FactCheckProposal, approver: string, approvedAt?: string): FactCheckProposal {
  const connectorRequired = hasConnectorRequirement(proposal)
  const mockEvidence = hasMockEvidence(proposal)

  return {
    ...proposal,
    publication: {
      allowed: !connectorRequired && !mockEvidence,
      reason: connectorRequired
        ? 'Validation humaine enregistrée, mais publication bloquée tant que les preuves requises ne sont pas collectées.'
        : mockEvidence
          ? 'Validation humaine enregistrée, mais publication bloquée tant que les preuves restent mockées.'
        : 'Validation humaine confirmée.',
    },
    validation: {
      status: 'approved',
      approver,
      approvedAt: approvedAt ?? new Date().toISOString(),
    },
  }
}

export function attachConnectorEvidence(
  proposal: FactCheckProposal,
  evidence: ConnectorEvidenceInput[],
  options?: { collectedAt?: string },
): FactCheckProposal {
  const collectedAt = options?.collectedAt ?? new Date().toISOString()
  const preparedEvidence: PreparedEvidence[] = evidence.map(
    ({ sourceUrl, retrievalTraceId, retrievedByConnector, ...item }) => ({
      ...item,
      mocked: false,
      requiresConnectorFields: [...CONNECTOR_REQUIRED_FIELDS],
      provenance: {
        provider: 'external-connector',
        retrievalMode: 'connector_live',
        collectedAt,
        connectorConfigured: true,
        note: 'Preuve collectée via un connecteur réel.',
        sourceUrl,
        retrievalTraceId,
        retrievedByConnector,
      },
    }),
  )

  return {
    ...proposal,
    evidence: preparedEvidence,
    analysis: analyzeClaim(proposal.request.claim, evidence),
    warnings: proposal.warnings.filter((warning) => warning.code !== 'MOCK_EVIDENCE' && warning.code !== 'CONNECTOR_REQUIRED'),
    publication: {
      allowed: false,
      reason: 'Publication bloquée tant qu’une nouvelle validation humaine explicite n’a pas été donnée.',
    },
    validation: {
      status: 'required',
    },
  }
}

export function rejectProposal(proposal: FactCheckProposal, approver: string, note?: string): FactCheckProposal {
  return {
    ...proposal,
    publication: {
      allowed: false,
      reason: 'Validation humaine refusée.',
    },
    validation: {
      status: 'rejected',
      approver,
      note,
    },
  }
}

export type PublishableFactCheck = {
  claim: string
  verdict: VerdictCode
  reliabilityScore: number
  confidenceScore: number
  approvedBy: string
  approvedAt: string
  evidenceCount: number
}

export function preparePublishableFactCheck(proposal: FactCheckProposal): PublishableFactCheck {
  if (proposal.validation.status !== 'approved' || !proposal.validation.approver || !proposal.validation.approvedAt) {
    throw new Error('Publication interdite : validation humaine requise.')
  }

  if (!proposal.publication.allowed || hasConnectorRequirement(proposal) || hasMockEvidence(proposal) || proposal.evidence.length === 0) {
    throw new Error('Publication interdite : preuves réelles exploitables requises avant publication.')
  }

  return {
    claim: proposal.request.claim,
    verdict: proposal.analysis.verdict,
    reliabilityScore: proposal.analysis.reliabilityScore,
    confidenceScore: proposal.analysis.confidenceScore,
    approvedBy: proposal.validation.approver,
    approvedAt: proposal.validation.approvedAt,
    evidenceCount: proposal.evidence.length,
  }
}
