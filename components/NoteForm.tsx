'use client'

import { useActionState } from 'react'
import { submitNote } from '@/app/actions/comments'

type Props = {
  entryId: string
  blocks: { id: string; preview: string }[]
}

const fieldClass = 'mt-1 w-full rounded border border-gray-400 bg-transparent px-3 py-2'

export default function NoteForm({ entryId, blocks }: Props) {
  const [state, formAction, pending] = useActionState(submitNote, null)

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="entryId" value={entryId} />

      <label className="block text-sm">
        Paragraf yang dicatat
        <select name="contentBlockId" required className={fieldClass}>
          {blocks.map((b, i) => (
            <option key={b.id} value={b.id}>
              Paragraf {i + 1}: {b.preview}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Catatan / teori
        <textarea name="body" required maxLength={2000} rows={3} className={fieldClass} />
      </label>

      <label className="block text-sm">
        Bukti (kutipan teks resmi atau nama buku di dalam game)
        <textarea name="evidence" required maxLength={2000} rows={3} className={fieldClass} />
      </label>

      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Mengirim...' : 'Ajukan'}
      </button>
    </form>
  )
}