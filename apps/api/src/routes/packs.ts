import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { PackRegistry } from '../pack-registry.js'
import type { PackGovernanceService } from '../services/pack-governance.js'

interface PackRoutesOptions extends FastifyPluginOptions {
  registry: PackRegistry
  /** When present, the reported `status` is the governed (activation-aware) status. */
  governance?: PackGovernanceService
}

/**
 * Control-pack read endpoints (engine TRD §17.2, ADR 0005). Read-only; no tenant scope.
 * - GET /api/v1/packs           — installed packs + validation status
 * - GET /api/v1/packs/:packKey  — one pack: entity-facts schema + control families (drives ENT-001)
 */
export async function registerPackRoutes(
  app: FastifyInstance,
  opts: PackRoutesOptions,
): Promise<void> {
  app.get('/packs', async () => ({
    packs: await Promise.all(
      opts.registry.list().map(async (p) => ({
        packKey: p.packKey,
        title: p.manifest?.title ?? null,
        jurisdiction: p.manifest?.jurisdiction ?? null,
        status: opts.governance
          ? await opts.governance.effectiveStatus(p.packKey)
          : (p.manifest?.status ?? null),
        onDiskStatus: p.manifest?.status ?? null,
        snapshotKey: p.manifest?.snapshotKey ?? null,
        valid: p.valid,
        issues: p.issues,
        computedChecksum: p.computedChecksum || null,
      })),
    ),
  }))

  app.get('/packs/:packKey', async (req, reply) => {
    const { packKey } = req.params as { packKey: string }
    const p = opts.registry.get(packKey)
    if (!p || !p.loaded) {
      return reply
        .code(404)
        .send({ error: { code: 'PACK_NOT_FOUND', message: `no pack "${packKey}"` } })
    }

    const familyCounts = new Map<string, number>()
    for (const c of p.loaded.controls) {
      familyCounts.set(c.family, (familyCounts.get(c.family) ?? 0) + 1)
    }

    return {
      packKey: p.packKey,
      title: p.manifest?.title ?? null,
      jurisdiction: p.manifest?.jurisdiction ?? null,
      snapshotKey: p.manifest?.snapshotKey ?? null,
      status: p.manifest?.status ?? null,
      valid: p.valid,
      controlCount: p.loaded.controls.length,
      controlFamilies: [...familyCounts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([family, count]) => ({ family, count })),
      entityFacts: p.loaded.entityFacts.facts,
      copy: {
        limitationStatement: p.loaded.copy.limitationStatement,
        forbiddenPhrases: p.loaded.copy.forbiddenPhrases,
      },
    }
  })
}
