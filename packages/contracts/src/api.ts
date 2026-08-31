/**
 * Request/response schemas for the HTTP API. Requests are validated at the
 * trust boundary (engine Handoff §8); responses are typed for the client.
 */
import { z } from './common.js'
import { FactValue } from './pack.js'

export const EntityKind = z.enum(['product', 'service'])
export type EntityKind = z.infer<typeof EntityKind>

/** POST /api/v1/entities */
export const CreateEntityRequest = z.object({
  packKey: z.string().min(1),
  name: z.string().min(1),
  entityIdentifier: z.string().min(1),
  entityKind: EntityKind,
  facts: z.record(FactValue),
})
export type CreateEntityRequest = z.infer<typeof CreateEntityRequest>

export const ClaimOrigin = z.enum([
  'SUPPLIER_ASSERTION',
  'INTERNAL_ASSERTION',
  'EXTRACTION_ACCEPTED',
  'IMPORTED_APPROVED_DATA',
])
export type ClaimOrigin = z.infer<typeof ClaimOrigin>

/** POST /api/v1/entities/:id/controls/:controlKey/claims */
export const AssertClaimRequest = z.object({
  value: z.string().min(1),
  unit: z.string().optional(),
  methodContext: z.string().optional(),
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
    .optional(),
  origin: ClaimOrigin.optional(),
  note: z.string().optional(),
  evidenceUrl: z.string().url().optional(),
})
export type AssertClaimRequest = z.infer<typeof AssertClaimRequest>

/** POST /api/v1/claims/:claimId/decisions */
export const ReviewDecisionRequest = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'CLARIFICATION_REQUESTED']),
  reason: z.string().optional(),
})
export type ReviewDecisionRequest = z.infer<typeof ReviewDecisionRequest>

/** POST /api/v1/entities/:id/requests */
export const CreateRequestRequest = z.object({
  controlKeys: z.array(z.string().min(1)).min(1),
  requiredControlKeys: z.array(z.string().min(1)).optional(),
  message: z.string().optional(),
  dueAt: z.string().optional(),
  expiresInDays: z.number().int().positive().max(365).optional(),
})
export type CreateRequestRequest = z.infer<typeof CreateRequestRequest>

/** POST /entities/:id/requests/:requestId/resend — revoke live grants, mint a new link. */
export const ResendRequestRequest = z.object({
  expiresInDays: z.number().int().positive().max(365).optional(),
})
export type ResendRequestRequest = z.infer<typeof ResendRequestRequest>

export const AvailabilityState = z.enum([
  'VALUE_SUPPLIED',
  'UNAVAILABLE',
  'UNKNOWN',
  'NOT_APPLICABLE',
  'NEEDS_CLARIFICATION',
])

/** POST /contributor/v1/requests/:token/submit */
export const ContributorSubmitRequest = z.object({
  submitterIdentity: z.string().optional(),
  items: z
    .array(
      z.object({
        requestItemId: z.string().min(1),
        value: z.string().optional(),
        unit: z.string().optional(),
        methodNote: z.string().optional(),
        availabilityState: AvailabilityState,
        comment: z.string().optional(),
      }),
    )
    .min(1),
})
export type ContributorSubmitRequest = z.infer<typeof ContributorSubmitRequest>

/**
 * PUT /contributor/v1/requests/:token/draft — save in-progress answers. Every
 * field is optional (a draft may be half-filled) and the item list may be empty.
 */
export const ContributorDraftRequest = z.object({
  submitterIdentity: z.string().optional(),
  items: z.array(
    z.object({
      requestItemId: z.string().min(1),
      value: z.string().optional(),
      unit: z.string().optional(),
      methodNote: z.string().optional(),
      availabilityState: AvailabilityState.optional(),
      comment: z.string().optional(),
    }),
  ),
})
export type ContributorDraftRequest = z.infer<typeof ContributorDraftRequest>
