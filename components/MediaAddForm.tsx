'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addMedia } from '@/app/actions/media'
import { youtubeId } from '@/lib/youtube'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const fieldClass =
  'mt-1 w-full rounded border border-gray-400 bg-transparent px-3 py-1.5 text-sm'

export default function MediaAddForm({
  entryId,
  blockId,
}: {
  entryId: string
  blockId: string
}) {
  const [mode, setMode] = useState<'image' | 'video'>('image')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)

    const form = e.currentTarget
    const fd = new FormData(form)
    const caption = String(fd.get('caption') ?? '').trim()

    const payload = new FormData()
    payload.set('blockId', blockId)
    payload.set('mediaType', mode)
    payload.set('caption', caption)

    let uploadedPath: string | null = null
    setBusy(true)

    try {
      if (mode === 'image') {
        const file = fd.get('file')
        if (!(file instanceof File) || file.size === 0) {
          setMessage({ ok: false, text: 'Pilih file gambar dulu.' })
          return
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
          setMessage({ ok: false, text: 'Hanya JPG, PNG, atau WebP.' })
          return
        }
        if (file.size > MAX_BYTES) {
          setMessage({ ok: false, text: 'Ukuran file maksimal 2MB.' })
          return
        }

        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${entryId}/${crypto.randomUUID()}.${ext}`

        const supabase = createClient()
        const { error } = await supabase.storage
          .from('lore-media')
          .upload(path, file, { contentType: file.type })
        if (error) {
          setMessage({ ok: false, text: 'Gagal mengunggah gambar.' })
          return
        }

        uploadedPath = path
        payload.set('mediaUrl', path)
      } else {
        const url = String(fd.get('url') ?? '').trim()
        if (!youtubeId(url)) {
          setMessage({ ok: false, text: 'Link YouTube tidak valid.' })
          return
        }
        payload.set('mediaUrl', url)
      }

      const result = await addMedia(payload)

      if (!result?.ok) {
        // Simpan ke database gagal: buang file yang terlanjur terunggah
        if (uploadedPath) {
          await createClient().storage.from('lore-media').remove([uploadedPath])
        }
        setMessage({ ok: false, text: result?.message ?? 'Gagal menyimpan media.' })
        return
      }

      form.reset()
      setMessage({ ok: true, text: 'Media ditambahkan.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-3 space-y-2">
      <label className="block text-xs">
        Jenis media
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as 'image' | 'video')}
          className={fieldClass}
        >
          <option value="image">Gambar (JPG/PNG/WebP, maks 2MB)</option>
          <option value="video">Video YouTube (tautan)</option>
        </select>
      </label>

      {mode === 'image' ? (
        <label className="block text-xs">
          File gambar
          <input
            type="file"
            name="file"
            accept=".jpg,.jpeg,.png,.webp"
            className={fieldClass}
          />
        </label>
      ) : (
        <label className="block text-xs">
          Tautan YouTube
          <input
            name="url"
            placeholder="https://www.youtube.com/watch?v=..."
            className={fieldClass}
          />
        </label>
      )}

      <label className="block text-xs">
        Caption (opsional)
        <input name="caption" maxLength={200} className={fieldClass} />
      </label>

      {message && (
        <p className={`text-sm ${message.ok ? 'text-green-600' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {busy ? 'Memproses...' : 'Tambah media'}
      </button>
    </form>
  )
}