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
      className="mt-2 space-y-2 rounded-md border border-rose/40 bg-rose/5 p-3"
    >
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />

      <p className="text-sm text-rose">
        Akan menghapus permanen &quot;{name}&quot; beserta: {summary}. Tindakan ini tidak
        bisa dibatalkan.
      </p>

      <input
        name="confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={`Ketik "${name}" untuk konfirmasi`}
        className="field py-1.5"
      />

      {state && !state.ok && <p className="text-sm text-rose">{state.message}</p>}

      <button
        type="submit"
        disabled={!matches || pending}
        className="btn-danger disabled:opacity-50"
      >
        {pending ? 'Menghapus...' : 'Hapus permanen'}
      </button>
    </form>
  )
}