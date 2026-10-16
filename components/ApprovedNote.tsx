'use client'

import { useState } from 'react'
import Link from 'next/link'
import RichText from '@/components/RichText'

type Props = { body: string; author: string; authorId?: string; edited: boolean }

export default function ApprovedNote({ body, author, authorId, edited }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2">
      <p
        onClick={(e) => {
          // Klik pada tautan tidak boleh ikut membuka/menutup tooltip
          if (!(e.target as HTMLElement).closest('a')) setOpen(!open)
        }}
        className="cursor-pointer italic text-yellow-600"
      >
        Note komunitas: <RichText text={body} />
        <button
          type="button"
          aria-expanded={open}
          aria-label="Info catatan komunitas"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(!open)
          }}
          className="ml-2 rounded border border-yellow-600/50 px-1.5 text-xs not-italic"
        >
          ?
        </button>
      </p>

      {open && (
        <p className="mt-1 text-xs opacity-70">
          Teks masih bersifat teori/spekulasi komunitas. Diajukan oleh{' '}
          {authorId ? (
            <Link href={`/profile/${authorId}`} className="underline">
              {author}
            </Link>
          ) : (
            author
          )}
          {edited ? ' (disunting lorekeeper)' : ''}.
        </p>
      )}
    </div>
  )
}