'use client'

import { useState } from 'react'
import Link from 'next/link'
import RichText from '@/components/RichText'

type Props = { body: string; author: string; authorId?: string; edited: boolean }

export default function ApprovedNote({ body, author, authorId, edited }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-l border-line py-1 pl-3">
      <p
        onClick={(e) => {
          // Klik pada tautan tidak boleh ikut membuka/menutup tooltip
          if (!(e.target as HTMLElement).closest('a')) setOpen(!open)
        }}
        className="cursor-pointer text-sm leading-relaxed text-muted"
      >
        <RichText text={body} />{' '}
        <button
          type="button"
          aria-expanded={open}
          aria-label="Info catatan komunitas"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(!open)
          }}
          className="whitespace-nowrap text-[11px] text-faint underline decoration-dotted underline-offset-2 hover:text-sky"
        >
          Spekulasi [?]
        </button>
      </p>

      {open && (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Teks masih bersifat teori/spekulasi komunitas. Diajukan oleh{' '}
          {authorId ? (
            <Link href={`/profile/${authorId}`} className="text-fg underline">
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
