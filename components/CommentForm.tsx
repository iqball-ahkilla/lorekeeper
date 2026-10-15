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
        className="w-full rounded border border-gray-400 bg-transparent px-3 py-2"
      />

      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Mengirim...' : 'Kirim'}
      </button>
    </form>
  )
}