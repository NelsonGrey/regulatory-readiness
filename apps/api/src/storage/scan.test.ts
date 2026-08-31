import { describe, expect, it } from 'vitest'
import { scanBytes } from './scan.js'

const PDF = 'application/pdf'
const EICAR = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')

describe('scanBytes', () => {
  it('accepts an allow-listed, in-size, clean file', () => {
    expect(scanBytes(Buffer.from('%PDF-1.4 ...'), PDF, 1000)).toEqual({ ok: true })
  })

  it('rejects an empty file', () => {
    expect(scanBytes(Buffer.alloc(0), PDF, 1000)).toMatchObject({
      ok: false,
      status: 'UNSUPPORTED',
    })
  })

  it('rejects a file over the size ceiling', () => {
    expect(scanBytes(Buffer.alloc(2000), PDF, 1000)).toMatchObject({
      ok: false,
      status: 'UNSUPPORTED',
    })
  })

  it('rejects a media type that is not accepted', () => {
    expect(scanBytes(Buffer.from('x'), 'application/x-msdownload', 1000)).toMatchObject({
      ok: false,
      status: 'UNSUPPORTED',
    })
  })

  it('flags the EICAR test signature as malware', () => {
    expect(scanBytes(EICAR, PDF, 10_000)).toMatchObject({ ok: false, status: 'REJECTED_MALWARE' })
  })
})
