import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ObjectStore } from './object-store.js'

export interface S3ObjectStoreConfig {
  region: string
  /** Quarantine bucket — presigned PUT target, isolated (ARCHITECTURE_AWS §4). */
  quarantineBucket: string
  /** Originals bucket — Object Lock + versioning; a clean object is copied here. */
  originalsBucket: string
  endpoint?: string
  credentials?: { accessKeyId: string; secretAccessKey: string }
  /** Presigned-URL lifetime in seconds. */
  ttlSeconds?: number
}

async function toBuffer(body: unknown): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

/** S3-backed object store. Keys are `quarantine/<tenant>/<doc>` and `originals/<tenant>/<doc>`. */
export function createS3ObjectStore(cfg: S3ObjectStoreConfig): ObjectStore {
  const client = new S3Client({
    region: cfg.region,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint, forcePathStyle: true } : {}),
    ...(cfg.credentials ? { credentials: cfg.credentials } : {}),
  })
  const ttl = cfg.ttlSeconds ?? 900
  const bucketFor = (key: string): string =>
    key.startsWith('originals/') ? cfg.originalsBucket : cfg.quarantineBucket
  const name = (key: string): string => key.replace(/^(quarantine|originals)\//, '')

  return {
    kind: 's3',
    async presignUpload(key) {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: cfg.quarantineBucket, Key: name(key) }),
        { expiresIn: ttl },
      )
      return { url, method: 'PUT' }
    },
    async head(key) {
      try {
        const res = await client.send(
          new HeadObjectCommand({ Bucket: bucketFor(key), Key: name(key) }),
        )
        return { size: res.ContentLength ?? 0 }
      } catch {
        return null
      }
    },
    async getBytes(key) {
      const res = await client.send(
        new GetObjectCommand({ Bucket: bucketFor(key), Key: name(key) }),
      )
      return toBuffer(res.Body)
    },
    async promote(fromKey, toKey) {
      await client.send(
        new CopyObjectCommand({
          Bucket: cfg.originalsBucket,
          Key: name(toKey),
          CopySource: `${cfg.quarantineBucket}/${name(fromKey)}`,
        }),
      )
    },
    async downloadUrl(key) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucketFor(key), Key: name(key) }),
        { expiresIn: ttl },
      )
    },
    async deleteTenant(tenantId) {
      let removed = 0
      for (const bucket of [cfg.quarantineBucket, cfg.originalsBucket]) {
        let token: string | undefined
        do {
          const listed = await client.send(
            new ListObjectsV2Command({
              Bucket: bucket,
              Prefix: `${tenantId}/`,
              ContinuationToken: token,
            }),
          )
          const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key)
          if (keys.length > 0) {
            await client.send(
              new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }),
            )
            removed += keys.length
          }
          token = listed.IsTruncated ? listed.NextContinuationToken : undefined
        } while (token)
      }
      return removed
    },
  }
}
