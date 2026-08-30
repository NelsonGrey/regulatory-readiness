import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { PackRegistry } from '../pack-registry.js'

interface PackRoutesOptions extends FastifyPluginOptions {
  registry: PackRegistry
}

/**
 * GET /api/v1/packs — list installed control packs and their validation status
 * (engine TRD §17.2, ADR 0005). Read-only; no tenant scope.
 */
export async function registerPackRoutes(
  app: FastifyInstance,
  opts: PackRoutesOptions,
): Promise<void> {
  app.get('/packs', async () => ({
    packs: opts.registry.list().map((p) => ({
      packKey: p.packKey,
      title: p.manifest?.title ?? null,
      jurisdiction: p.manifest?.jurisdiction ?? null,
      status: p.manifest?.status ?? null,
      snapshotKey: p.manifest?.snapshotKey ?? null,
      valid: p.valid,
      issues: p.issues,
      computedChecksum: p.computedChecksum || null,
    })),
  }))
}
