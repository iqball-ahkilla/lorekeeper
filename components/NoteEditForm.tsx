'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { editOwnNote } from '@/app/actions/posts'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

type Existing = { id: string; file_name: string; file_type: 'image' | 'document' }

type Uploaded = { path: string; name: string; type: 'image' | 'document' }

type Props = {
  postId: string
  userId: string
  initialBody: string
  initialEvidence: string
  existing: Existing[]
}

const fieldClass =
  'field mt-1'

export default function NoteEditForm({
  postId,
  userId,
  initialBody,
  initialEvidence,
  existing,
}: Props) {
  const [keep, setKeep] = useState<Set<string>>(() => new Set(existing.map((e) => e.id)))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function toggleKeep(id: string) {
    setKeep((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)

    const fd = new FormData(e.currentTarget)
    const body = String(fd.get('body') ?? '').trim()
    const evidence = String(fd.get('evidence') ?? '').trim()
    const files = fd
      .getAll('files')
      .filter((f): f is File => f instanceof File && f.size > 0)

    if (keep.size + files.length > 2) {
      setMessage({ ok: false, text: 'Maksimal 2 lampiran, termasuk yang dipertahankan.' })
      return
    }
    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setMessage({ ok: false, text: `${f.name}: hanya JPG, PNG, WebP, atau PDF.` })
        return
      }
      if (f.size > MAX_BYTES) {
        setMessage({ ok: false, text: `${f.name}: ukuran maksimal 2MB.` })
        return
      }
    }
    if (evidence.length === 0 && keep.size + files.length === 0) {
      setMessage({ ok: false, text: 'Isi bukti teks atau sisakan minimal satu lampiran.' })
      return
    }

    setBusy(true)
    const supabase = createClient()
    const uploaded: Uploaded[] = []

    const cleanup = async () => {
      if (uploaded.length > 0) {
        await supabase.storage.from('evidence').remove(uploaded.map((u) => u.path))
      }
    }

    try {
      for (const f of files) {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? 'bin'
        const path = `${userId}/${crypto.randomUUID()}.${ext}`

        const { error } = await supabase.storage
          .from('evidence')
          .upload(path, f, { contentType: f.type })
        if (error) {
          await cleanup()
          setMessage({ ok: false, text: `Gagal mengunggah ${f.name}.` })
          return
        }
        uploaded.push({
          path,
          name: f.name,
          type: f.type.startsWith('image/') ? 'image' : 'document',
        })
      }

      const payload = new FormData()
      payload.set('postId', postId)
      payload.set('body', body)
      payload.set('evidence', evidence)
      payload.set('keep', JSON.stringify([...keep]))
      payload.set('attachments', JSON.stringify(uploaded))

      const result = await editOwnNote(payload)
      if (!result?.ok) {
        await cleanup()
        setMessage({ ok: false, text: result?.message ?? 'Gagal menyimpan.' })
        return
      }

      setMessage({ ok: true, text: 'Tersimpan. Catatan kembali ke antrian review.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm">
        Catatan / teori
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={3}
          defaultValue={initialBody}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        Bukti berupa teks
        <textarea
          name="evidence"
          maxLength={2000}
          rows={3}
          defaultValue={initialEvidence}
          className={fieldClass}
        />
      </label>

      {existing.length > 0 && (
        <fieldset className="space-y-1 text-sm">
          <legend className="text-xs text-faint">Lampiran saat ini (centang untuk dipertahankan)</legend>
          {existing.map((a) => (
            <label key={a.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={keep.has(a.id)}
                onChange={() => toggleKeep(a.id)}
              />
              {a.file_type === 'image' ? 'Gambar' : 'Dokumen'}: {a.file_name}
            </label>
          ))}
        </fieldset>
      )}

      <label className="block text-sm">
        Tambah file baru (JPG/PNG/WebP/PDF, maks 2MB; total lampiran maksimal 2)
        <input
          type="file"
          name="files"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className={fieldClass}
        />
      </label>

      {message && (
        <p className={`text-sm ${message.ok ? 'text-emerald-300' : 'text-rose'}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="btn-gold disabled:opacity-50"
      >
        {busy ? 'Menyimpan...' : 'Simpan perubahan'}
      </button>
    </form>
  )
}