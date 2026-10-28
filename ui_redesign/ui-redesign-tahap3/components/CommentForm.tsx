'use client'

import { useActionState } from 'react'
import { addComment } from '@/app/actions/comments'

type Props = {
  entryId: string
  parentId?: string
  placeholder?: string
}

export default function CommentForm({ entryId, parentId, placeholder }: Props) {
  const [state, formAction, pending] = useActionState(addComment, null)

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="entryId" value={entryId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}

      <textarea
        name="body"
        required
        maxLength={2000}
        rows={3}
        placeholder={placeholder}
        className="field"
      />

      {state?.error && <p className="text-sm text-rose">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="btn-gold disabled:opacity-50"
      >
        {pending ? 'Mengirim...' : 'Kirim'}
      </button>
    </form>
  )
}