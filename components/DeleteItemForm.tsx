'use client'

import { useActionState, useState, startTransition } from 'react'
import { deleteItem } from '@/app/actions/structure'

type Props = {
  type: 'region' | 'subsection' | 'entry'
  id: string
  name: string
  summary: string
}

export default function DeleteItemForm({ type, id, name, summary }: Props) {
  const [state, formAction, pending] = useActionState(deleteItem, null)
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === name

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        startTransition(() => formAction(formData))
      }}
      className="mt-2 space-y-2 rounded border border-red-500/40 p-3"
    >
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />

      <p className="text-sm text-red-500">
        Akan menghapus permanen &quot;{name}&quot; beserta: {summary}. Tindakan ini tidak
        bisa dibatalkan.
      </p>

      <input
        name="confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={`Ketik "${name}" untuk konfirmasi`}
        className="w-full rounded border border-gray-400 bg-transparent px-3 py-1.5 text-sm"
      />

      {state && !state.ok && <p className="text-sm text-red-500">{state.message}</p>}

      <button
        type="submit"
        disabled={!matches || pending}
        className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Menghapus...' : 'Hapus permanen'}
      </button>
    </form>
  )
}