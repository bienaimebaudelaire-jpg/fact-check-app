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
  retrievalMode: 'local_mock' | 'connector_required'
  collectedAt: string
  connectorConfigured: boolean
  note: string
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

const CONNECTOR_REQUIRED_FIELDS = ['sourceUrl', 'retrievalTraceId', 'retrievedByConnector'] as const

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
  return {
    ...proposal,
    publication: {
      allowed: true,
      reason: 'Validation humaine confirmée.',
    },
    validation: {
      status: 'approved',
      approver,
      approvedAt: approvedAt ?? new Date().toISOString(),
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
