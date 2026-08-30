import type { FastifyInstance } from 'fastify'

type InjectResponse = Awaited<ReturnType<FastifyInstance['inject']>>

export const TENANT = 't-demo'
export const ACTOR = 'manager@acme'

export const APPLICABILITY_RESULTS = [
  'REQUIRED_BY_SNAPSHOT',
  'OPTIONAL_IF_AVAILABLE',
  'CONDITIONAL_FACT_REQUIRED',
  'NOT_YET_REQUIRED_BY_SNAPSHOT',
  'DUPLICATE_SOURCE_FIELD',
  'NOT_APPLICABLE_TO_CLASSIFICATION',
  'NEEDS_SPECIALIST_REVIEW',
] as const

/** A full, valid create-entity request for the accessibility pack (bank service). */
export function bankEntityRequest() {
  return {
    packKey: 'eaa-accessibility',
    name: 'Acme Bank Online',
    entityIdentifier: 'acme-online',
    entityKind: 'service' as const,
    facts: {
      offeredToConsumersInIE: true,
      serviceType: 'consumer_banking',
      operatorRole: 'provider',
      isMicroEnterprise: false,
      hasWebsite: true,
      hasMobileApp: true,
      hasNonWebSoftware: false,
      providesDownloadableDocuments: false,
      usesSelfServiceTerminals: false,
      disproportionateBurdenClaimed: false,
      fundamentalAlterationClaimed: false,
    } as Record<string, unknown>,
  }
}

export function createEntity(
  app: FastifyInstance,
  payload: unknown,
  tenant: string = TENANT,
): Promise<InjectResponse> {
  return app.inject({
    method: 'POST',
    url: '/api/v1/entities',
    headers: { 'x-tenant-id': tenant, 'x-actor': ACTOR },
    payload: payload as Record<string, unknown>,
  })
}

export function getMatrix(
  app: FastifyInstance,
  id: string,
  tenant: string = TENANT,
): Promise<InjectResponse> {
  return app.inject({
    method: 'GET',
    url: `/api/v1/entities/${id}/matrix`,
    headers: { 'x-tenant-id': tenant },
  })
}
