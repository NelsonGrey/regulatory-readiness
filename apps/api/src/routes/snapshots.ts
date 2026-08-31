import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { authFromRequest } from '../auth.js'
import type { SnapshotService } from '../services/snapshots.js'

interface SnapshotRoutesOptions extends FastifyPluginOptions {
  snapshots: SnapshotService
}

const NO_TENANT = { error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } }
const NOT_FOUND = { error: { code: 'NOT_FOUND', message: 'readiness snapshot not found' } }

/** Readiness snapshots + canonical export (engine TRD §14). */
export async function registerSnapshotRoutes(
  app: FastifyInstance,
  opts: SnapshotRoutesOptions,
): Promise<void> {
  app.post('/entities/:id/readiness-snapshots', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { id } = req.params as { id: string }
    const result = await opts.snapshots.create(auth, id)
    if (!result.ok) {
      return reply.code(404).send({ error: { code: result.code, message: result.message } })
    }
    const {
      id: snapshotId,
      contentHash,
      entityStatus,
      snapshotKey,
      readinessCounts,
      createdAt,
    } = result.snapshot
    return reply
      .code(201)
      .send({ id: snapshotId, contentHash, entityStatus, snapshotKey, readinessCounts, createdAt })
  })

  app.get('/entities/:id/readiness-snapshots', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { id } = req.params as { id: string }
    return { snapshots: await opts.snapshots.list(auth, id) }
  })

  app.get('/readiness-snapshots/:snapshotId', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { snapshotId } = req.params as { snapshotId: string }
    const snap = await opts.snapshots.get(auth, snapshotId)
    if (!snap) return reply.code(404).send(NOT_FOUND)
    return snap
  })

  app.get('/readiness-snapshots/:snapshotId/export.json', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { snapshotId } = req.params as { snapshotId: string }
    const snap = await opts.snapshots.get(auth, snapshotId)
    if (!snap) return reply.code(404).send(NOT_FOUND)
    return reply
      .header('content-type', 'application/json')
      .header('content-disposition', `attachment; filename="readiness-${snapshotId}.json"`)
      .send(snap.document)
  })

  app.get('/readiness-snapshots/:snapshotId/export.csv', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { snapshotId } = req.params as { snapshotId: string }
    const csv = await opts.snapshots.exportCsv(auth, snapshotId)
    if (csv === null) return reply.code(404).send(NOT_FOUND)
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="readiness-${snapshotId}.csv"`)
      .send(csv)
  })
}
