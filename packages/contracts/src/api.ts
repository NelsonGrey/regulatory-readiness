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
