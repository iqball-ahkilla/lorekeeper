'use client'

import { useActionState, useEffect, useRef, useState, startTransition } from 'react'
import { submitNote } from '@/app/actions/comments'
import { createClient } from '@/lib/supabase/client'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

type Props = {
  entryId: string
  userId: string
  blocks: { id: string; preview: string }[]
}

type Uploaded = { path: string; name: string; type: 'image' | 'document' }

const fieldClass = 'field mt-1'

export default function NoteForm({ entryId, userId, blocks }: Props) {
  const [state, formAction, pending] = useActionState(submitNote, null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const uploadedRef = useRef<string[]>([])

  // Hasil pengajuan: kalau gagal, buang file yang terlanjur terunggah
  useEffect(() => {
    if (!state) return
    if (state.error !== null && uploadedRef.current.length > 0) {
      void createClient().storage.from('evidence').remove(uploadedRef.current)
    }
    uploadedRef.current = []
  }, [state])

  // Kosongkan form setelah note berhasil dikirim
  useEffect(() => {
    if (state && state.error === null) formRef.current?.reset()
  }, [state])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setClientError(null)

    const formData = new FormData(e.currentTarget)
    const files = formData
      .getAll('files')
      .filter((f): f is File => f instanceof File && f.size > 0)

    if (files.length > 2) {
      setClientError('Maksimal 2 lampiran.')
      return
    }
    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setClientError(`${f.name}: hanya JPG, PNG, WebP, atau PDF.`)
        return
      }
      if (f.size > MAX_BYTES) {
        setClientError(`${f.name}: ukuran maksimal 2MB.`)
        return
      }
    }

    const uploaded: Uploaded[] = []
    if (files.length > 0) {
      setUploading(true)
      const supabase = createClient()

      for (const f of files) {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? 'bin'
        const path = `${userId}/${crypto.randomUUID()}.${ext}`

        const { error } = await supabase.storage
          .from('evidence')
          .upload(path, f, { contentType: f.type })

        if (error) {
          // Hapus file yang sudah terlanjur terunggah agar tidak menjadi sampah
          if (uploaded.length > 0) {
            await supabase.storage.from('evidence').remove(uploaded.map((u) => u.path))
          }
          setUploading(false)
          setClientError(`Gagal mengunggah ${f.name}.`)
          return
        }

        uploaded.push({
          path,
          name: f.name,
          type: f.type.startsWith('image/') ? 'image' : 'document',
        })
      }
      setUploading(false)
    }

    uploadedRef.current = uploaded.map((u) => u.path)

    formData.delete('files')
    formData.set('attachments', JSON.stringify(uploaded))
    startTransition(() => formAction(formData))
  }

  const busy = pending || uploading
  const error = clientError ?? state?.error

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="entryId" value={entryId} />

      <label className="block text-sm text-muted">
        Paragraf yang dicatat
        <select name="contentBlockId" required className={fieldClass}>
          {blocks.map((b, i) => (
            <option key={b.id} value={b.id}>
              Paragraf {i + 1}: {b.preview}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-muted">
        Catatan / teori
        <textarea name="body" required maxLength={2000} rows={3} className={fieldClass} />
      </label>

      <label className="block text-sm text-muted">
        Bukti berupa teks (kutipan resmi atau nama buku di dalam game)
        <textarea name="evidence" maxLength={2000} rows={3} className={fieldClass} />
      </label>

      <label className="block text-sm text-muted">
        Bukti berupa file (opsional, maksimal 2 file, JPG/PNG/WebP/PDF, masing-masing 2MB)
        <input
          type="file"
          name="files"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className={fieldClass}
        />
      </label>
      <p className="text-xs text-faint">Isi minimal salah satu: bukti teks atau file.</p>

      {error && <p className="text-sm text-rose">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="btn-gold disabled:opacity-50"
      >
        {uploading ? 'Mengunggah file...' : pending ? 'Mengirim...' : 'Ajukan'}
      </button>
    </form>
  )
}