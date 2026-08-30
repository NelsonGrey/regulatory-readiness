import { describe, expect, it } from 'vitest'
import { createLogger } from '@rre/observability'
import { handlers } from './handlers.js'

describe('worker handlers', () => {
  it('registers one handler per queue', () => {
    expect(Object.keys(handlers).sort()).toEqual(
      ['export', 'extraction', 'notify', 'ocr', 'scan-result'].sort(),
    )
  })

  it('handlers resolve without throwing (stubs)', async () => {
    const log = createLogger({ level: 'error' })
    for (const handler of Object.values(handlers)) {
      await expect(handler({}, { log })).resolves.toBeUndefined()
    }
  })
})
