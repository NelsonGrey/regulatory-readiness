export interface PackSummary {
  packKey: string
  title: string | null
  jurisdiction: string | null
  status: string | null
  onDiskStatus?: string | null
  snapshotKey: string | null
  valid: boolean
}

export interface PackList {
  packs: PackSummary[]
  activationEnforced: boolean
}

export interface EntityFact {
  name: string
  type: 'boolean' | 'string' | 'number' | 'enum' | 'object'
  enumValues?: string[]
  required: boolean
  description?: string
}

export interface PackDetail {
  packKey: string
  title: string | null
  jurisdiction: string | null
  snapshotKey: string | null
  status: string | null
  valid: boolean
  controlCount: number
  controlFamilies: { family: string; count: number }[]
  entityFacts: EntityFact[]
  copy: { limitationStatement: string; forbiddenPhrases: string[] }
}

export interface CreateEntityResponse {
  entity: {
    id: string
    name: string
    packKey: string
    entityKind: string
    createdAt: string
    createdBy: string
  }
  evaluation: { id: string; snapshotKey: string; hash: string; version: number }
}

export interface MatrixRow {
  control: string
  title: string
  family: string
  standardClause: string | null
  wcagSc: string | null
  accessClassDefault: string
  evidenceExpectation: string | null
  applicability: string
  reason?: string
  readiness: string
  approvedValue: string | null
  approvedUnit: string | null
  pendingClaims: number
  evidenceCount: number
  originalApplicability: string | null
  overrideRationale: string | null
}

export interface EvidenceView {
  linkId: string
  claimId: string
  supportType: 'SUPPORTS' | 'CONTEXT' | 'CONTRADICTS'
  documentId: string
  documentFilename: string | null
  documentHash: string | null
  page: number | null
  sheet: string | null
  cell: string | null
  quote: string | null
  addedBy: string
  createdAt: string
}

export type ReadinessCounts = Record<string, number>

export type EntityStatus = 'BLOCKED' | 'REVIEW_NEEDED' | 'EVIDENCE_READY' | 'OUTDATED_SNAPSHOT'

export interface ClaimSummary {
  id: string
  controlKey: string
  value: string
  unit: string | null
  origin: string
  status: string
  revision: number
  assertedBy: string
  assertedAt: string
}

export interface ReviewQueue {
  entityId: string
  items: ClaimSummary[]
}

export interface ApplicabilitySummary {
  total: number
  requiredNow: number
  optional: number
  conditional: number
  notApplicable: number
  notYetRequired: number
  needsSpecialistReview: number
  duplicate: number
}

export type RequestStatus =
  'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'SUBMITTED' | 'CLOSED' | 'CANCELLED' | 'EXPIRED'

export type AvailabilityState =
  'VALUE_SUPPLIED' | 'UNAVAILABLE' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'NEEDS_CLARIFICATION'

export interface EvidenceRequest {
  id: string
  entityId: string
  packKey: string
  status: RequestStatus
  message: string | null
  dueAt: string | null
  createdBy: string
  createdAt: string
}

export interface RequestItem {
  id: string
  requestId: string
  controlKey: string
  instructions: string | null
  requiredInRequest: boolean
}

export interface CreateRequestResponse {
  request: EvidenceRequest
  items: RequestItem[]
  token: string
  tokenPrefix: string
  expiresAt: string
  contributorPath: string
}

export interface RequestGrantView {
  tokenPrefix: string
  expiresAt: string
  revokedAt: string | null
  uses: number
}

export interface RequestSubmissionResponse {
  id: string
  controlKey: string
  value: string | null
  unit: string | null
  availabilityState: AvailabilityState
}

export interface RequestSubmissionView {
  id: string
  version: number
  submittedAt: string
  responses: RequestSubmissionResponse[]
}

export interface RequestDetail {
  request: EvidenceRequest
  items: RequestItem[]
  grants: RequestGrantView[]
  submissions: RequestSubmissionView[]
  draftUpdatedAt: string | null
}

export interface ContributorItemView {
  requestItemId: string
  controlKey: string
  title: string
  instructions: string | null
  required: boolean
}

export interface ContributorDraftItem {
  requestItemId: string
  value?: string | null
  unit?: string | null
  methodNote?: string | null
  availabilityState?: AvailabilityState | null
  comment?: string | null
}

export interface ContributorDraft {
  submitterIdentity?: string | null
  items: ContributorDraftItem[]
}

export interface ContributorView {
  requestingOrganization: string
  entityName: string
  dueAt: string | null
  status: RequestStatus
  items: ContributorItemView[]
  draft: ContributorDraft | null
}

export interface ContributorReceipt {
  receiptId: string
  submittedAt: string
  itemCount: number
  version: number
  note: string
}

export type DocumentStatus =
  | 'UPLOADING'
  | 'SCANNING'
  | 'AVAILABLE'
  | 'REJECTED_MALWARE'
  | 'UNSUPPORTED'
  | 'DELETED_PENDING_PURGE'
  | 'PURGED'

export interface DocumentRecord {
  id: string
  filename: string
  mediaType: string
  sizeBytes: number
  contentHash: string | null
  accessClass: string
  status: DocumentStatus
  scanNote: string | null
  ingestedBy: string
  createdAt: string
  availableAt: string | null
}

export interface InitiateUploadResponse {
  documentId: string
  uploadUrl: string
  uploadMethod: 'PUT'
  objectKey: string
}

export interface EvaluationDiff {
  added: string[]
  removed: string[]
  applicabilityChanged: Array<{ control: string; from: string; to: string }>
  unchanged: number
}

export interface ReEvaluateResponse {
  ok: true
  evaluationId: string
  version: number
  snapshotKey: string
  diff: EvaluationDiff
}

export interface ImpactedEntity {
  entityId: string
  name: string
  snapshotKey: string
  evaluationVersion: number
  addedControls: string[]
  removedControls: string[]
  orphanedClaims: number
}

export interface SnapshotImpactReport {
  packKey: string
  currentSnapshotKey: string
  upToDate: number
  impacted: ImpactedEntity[]
}

export interface ExtractionRun {
  id: string
  documentId: string
  entityId: string
  extractorName: string
  modelId: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  error: string | null
  proposalCount: number
  startedBy: string
  startedAt: string
  finishedAt: string | null
}

export interface ValidationFinding {
  level: 'error' | 'warn'
  code: string
  message: string
}

export interface ExtractionProposal {
  id: string
  runId: string
  documentId: string
  controlKey: string
  value: string
  unit: string | null
  method: string | null
  confidence: number | null
  page: number | null
  quote: string
  validation: ValidationFinding[]
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED'
  reason: string | null
  acceptedClaimId: string | null
}

export interface NotificationRecord {
  id: string
  eventTopic: string
  title: string
  body: string
  entityId: string | null
  targetType: string | null
  targetId: string | null
  readAt: string | null
  createdAt: string
}

export interface NotificationList {
  notifications: NotificationRecord[]
  unreadCount: number
}

export interface SnapshotSummary {
  id: string
  entityId: string
  packKey: string
  snapshotKey: string
  evaluationId: string
  entityStatus: EntityStatus
  readinessCounts: ReadinessCounts
  contentHash: string
  createdBy: string
  createdAt: string
}

export interface CreateSnapshotResponse {
  id: string
  contentHash: string
  entityStatus: EntityStatus
  snapshotKey: string
  readinessCounts: ReadinessCounts
  createdAt: string
}

export interface DeletionRequestRecord {
  id: string
  tenantId: string
  scope: 'tenant'
  status: 'REQUESTED' | 'COMPLETED' | 'CANCELLED'
  preview: Record<string, number>
  purged: Record<string, number> | null
  requestedBy: string
  requestedAt: string
  completedBy: string | null
  completedAt: string | null
}

export interface DeletionRequestList {
  deletionRequests: DeletionRequestRecord[]
}

export interface RequestDeletionResponse {
  deletionRequestId: string
  preview: Record<string, number>
}

export interface ExecuteDeletionResponse {
  ok: true
  purged: Record<string, number>
  objectsRemoved: number
}

export type MemberRole = 'owner' | 'admin' | 'member'

export interface Workspace {
  id: string
  name: string
  slug: string
  plan: string
  role: MemberRole
}

export interface WorkspaceList {
  workspaces: Workspace[]
}

export interface CreateWorkspaceResponse {
  workspace: { id: string; name: string; slug: string; plan: string }
  role: MemberRole
}

export interface Member {
  userId: string
  email: string
  name: string | null
  role: MemberRole
  createdAt: string
}

export interface PendingInvite {
  id: string
  email: string
  role: 'admin' | 'member'
  expiresAt: string
  createdAt: string
}

export interface MembersResponse {
  members: Member[]
  pendingInvites: PendingInvite[]
}

export interface InviteResponse {
  inviteId: string
  token: string
  acceptPath: string
  expiresAt: string
}

export interface AcceptInviteResponse {
  workspace: { id: string; name: string }
  role: MemberRole
}

export interface EntitySummary {
  id: string
  name: string
  entityIdentifier: string
  packKey: string
  entityKind: string
  createdAt: string
  snapshotKey: string
  evaluationVersion: number
  entityStatus: EntityStatus
  readinessCounts: ReadinessCounts
}

export interface EntityList {
  entities: EntitySummary[]
}

export interface PackActivation {
  packKey: string
  checksum: string
  status: 'active' | 'withdrawn'
  activatedBy: string
  activatedAt: string
  withdrawnBy: string | null
  withdrawnAt: string | null
}

export interface PackOverview {
  packKey: string
  title: string | null
  onDiskStatus: string | null
  computedChecksum: string
  valid: boolean
  issues: Array<{ severity: string; code: string; message: string }>
  reviews: Array<{ reviewer: string; note: string | null; at: string }>
  distinctReviewers: number
  activation: PackActivation | null
  effectiveStatus: string
  driftedSinceActivation: boolean
  canActivate: boolean
  blockers: string[]
}

export interface PackOverviewList {
  packs: PackOverview[]
}

export interface BillingSummary {
  plan: 'trial' | 'starter' | 'growth'
  status: 'trialing' | 'active' | 'past_due' | 'canceled'
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  limits: { entities: number | null; seats: number | null }
  usage: { entities: number; seats: number }
}

export interface CheckoutResponse {
  url: string
}

export interface EntityMatrix {
  entity: {
    id: string
    name: string
    packKey: string
    entityKind: string
    entityIdentifier: string
  }
  evaluation: {
    id: string
    snapshotKey: string
    evaluatedAt: string
    hash: string
    version: number
  }
  summary: ApplicabilitySummary
  entityStatus: EntityStatus
  readinessCounts: ReadinessCounts
  rows: MatrixRow[]
}
