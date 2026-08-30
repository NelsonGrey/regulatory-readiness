export interface PackSummary {
  packKey: string
  title: string | null
  jurisdiction: string | null
  status: string | null
  snapshotKey: string | null
  valid: boolean
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
  applicability: string
  reason?: string
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
  rows: MatrixRow[]
}
