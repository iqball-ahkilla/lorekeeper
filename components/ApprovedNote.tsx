'use client'

import { useState } from 'react'

import Link from 'next/link'

type Props = { 
    body: string; 
    author: string;
    authorId: string; 
    edited: boolean
}

export default function ApprovedNote({ body, author, authorId, edited }: Props) {
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
          Teks masih bersifat teori/spekulasi komunitas. Diajukan oleh{' '}
          <Link
            href={`/profile/${authorId}`}
            className="underline">
            {author}
          </Link>
          {edited ? ' (disunting lorekeeper)' : ''}.
        </p>
      )}
    </div>
  )
}