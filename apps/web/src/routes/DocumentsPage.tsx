import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import type { DocumentRecord, InitiateUploadResponse } from '../api/types.js'

const STATUS_LABEL: Record<string, string> = {
  UPLOADING: 'Uploading',
  SCANNING: 'Scanning',
  AVAILABLE: 'Available',
  REJECTED_MALWARE: 'Rejected — malware',
  UNSUPPORTED: 'Rejected — unsupported',
  DELETED_PENDING_PURGE: 'Deleting',
  PURGED: 'Purged',
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function DocumentsPage(): ReactElement {
  const { id = '' } = useParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<DocumentRecord[]>([])
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<{ documents: DocumentRecord[] }>(`/documents?entityId=${id}`)
      .then((r) => {
        if (!live) return
        setDocs(r.documents)
        setStatus('ok')
      })
      .catch((e: unknown) => {
        if (!live) return
        setStatus(e instanceof ApiError && e.status === 404 ? 'notfound' : 'error')
      })
    return () => {
      live = false
    }
  }, [id])

  useEffect(() => load(), [load, version])

  async function upload(file: File): Promise<void> {
    setBusy('upload')
    setError(null)
    try {
      const started = await api.post<InitiateUploadResponse>('/documents', {
        filename: file.name,
        mediaType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        entityId: id,
      })
      await api.putBytes(started.uploadUrl, file)
      const final = await api.post<{ status: string; scanNote: string | null }>(
        `/documents/${started.documentId}/finalize`,
        {},
      )
      if (final.status !== 'AVAILABLE') {
        setError(
          `Upload rejected (${STATUS_LABEL[final.status] ?? final.status})${final.scanNote ? `: ${final.scanNote}` : ''}`,
        )
      }
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy('')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function download(doc: DocumentRecord): Promise<void> {
    setBusy(doc.id)
    setError(null)
    try {
      const { url } = await api.get<{ url: string }>(`/documents/${doc.id}/download`)
      saveBlob(doc.filename, await api.getBlob(url))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setBusy('')
    }
  }

  if (status === 'loading') return <p>Loading documents…</p>
  if (status === 'notfound') return <p className="rre-error">Entity not found in this workspace.</p>
  if (status === 'error') return <p className="rre-error">Could not load documents.</p>

  return (
    <section>
      <h1>Documents</h1>
      <p>
        <Link to={`/w/entities/${id}/matrix`}>← Back to the matrix</Link>
      </p>
      <p className="rre-note">
        Uploads are scanned before they become available. Original files are stored unchanged; a
        SHA-256 is recorded. A recorded hash is not proof of authenticity.
      </p>

      {error ? (
        <p className="rre-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rre-actions">
        <input
          ref={inputRef}
          type="file"
          aria-label="Choose a file to upload"
          disabled={busy === 'upload'}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
          }}
        />
        {busy === 'upload' ? <span className="rre-note">Uploading…</span> : null}
      </div>

      {docs.length === 0 ? (
        <p>No documents yet.</p>
      ) : (
        <table className="rre-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Type</th>
              <th>Size</th>
              <th>Status</th>
              <th>SHA-256</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.filename}</td>
                <td>{d.mediaType}</td>
                <td>{fmtSize(d.sizeBytes)}</td>
                <td data-status={d.status}>
                  {STATUS_LABEL[d.status] ?? d.status}
                  {d.scanNote ? <div className="rre-note">{d.scanNote}</div> : null}
                </td>
                <td>{d.contentHash ? <code>{d.contentHash.slice(0, 19)}…</code> : '—'}</td>
                <td>
                  {d.status === 'AVAILABLE' ? (
                    <button
                      type="button"
                      className="rre-secondary"
                      disabled={busy === d.id}
                      onClick={() => download(d)}
                    >
                      Download
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
