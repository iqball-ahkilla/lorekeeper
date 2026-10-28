'use client'

import { useState } from 'react'
import Link from 'next/link'
import RichText from '@/components/RichText'

type Props = { body: string; author: string; authorId?: string; edited: boolean }

export default function ApprovedNote({ body, author, authorId, edited }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4 rounded-r-md border-l-2 border-gold-dim bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow">Catatan komunitas · disetujui</span>
        <button
          type="button"
          aria-expanded={open}
          aria-label="Info catatan komunitas"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(!open)
          }}
          className="chip border-sky/30 text-sky hover:bg-sky/10"
        >
          Spekulasi komunitas [?]
        </button>
      </div>

      <p
        onClick={(e) => {
          // Klik pada tautan tidak boleh ikut membuka/menutup tooltip
          if (!(e.target as HTMLElement).closest('a')) setOpen(!open)
        }}
        className="mt-2 cursor-pointer italic leading-relaxed text-gold"
      >
        <RichText text={body} />
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
