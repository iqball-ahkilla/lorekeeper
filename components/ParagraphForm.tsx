'use client'

import { useActionState, startTransition } from 'react'
import { updateParagraph } from '@/app/actions/content'
import LinkTextarea, { type LinkTarget } from '@/components/LinkTextarea'

type Props = {
  blockId: string
  label: string
  initial: string
  targets: LinkTarget[]
}

export default function ParagraphForm({ blockId, label, initial, targets }: Props) {
  const [state, formAction, pending] = useActionState(updateParagraph, null)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        startTransition(() => formAction(formData))
      }}
      className="space-y-2"
    >
      <input type="hidden" name="blockId" value={blockId} />
      <p className="text-sm font-medium">{label}</p>

      <LinkTextarea
        name="body"
        defaultValue={initial}
        targets={targets}
        rows={5}
        maxLength={5000}
        required
        className="w-full rounded border border-gray-400 bg-transparent px-3 py-2"
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Menyimpan...' : 'Simpan'}
        </button>
        {state && (
          <span className={`text-sm ${state.ok ? 'text-green-600' : 'text-red-500'}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  )
}