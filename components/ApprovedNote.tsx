'use client'

import { useState } from 'react'

type Props = { body: string; author: string; edited: boolean }

export default function ApprovedNote({ body, author, edited }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="text-left italic text-yellow-600"
      >
        Note komunitas: {body}
      </button>

      {open && (
        <p className="mt-1 text-xs opacity-70">
          Teks masih bersifat teori/spekulasi komunitas. Diajukan oleh {author}
          {edited ? ' (disunting lorekeeper)' : ''}.
        </p>
      )}
    </div>
  )
}