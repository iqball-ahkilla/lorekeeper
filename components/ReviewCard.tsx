import Link from 'next/link'
import {
  startReview,
  approveNote,
  rejectNote,
  editNote,
} from '@/app/actions/review'

import Attachments, { type Attachment } from '@/components/Attachments'

export type ReviewNote = {
  id: string
  status: 'submitted' | 'under_review' | 'approved'
  body: string
  evidence_text: string | null
  created_at: string
  edited_at: string | null
  profiles: { username: string }
  content_blocks: { body: string } | null
  lore_entries: {
    title: string
    slug: string
    subsections: { slug: string; regions: { slug: string } }
  }
  note_attachments: Attachment[]
  note_votes: { user_id: string }[]
}

const statusLabel = {
  submitted: 'Baru masuk',
  under_review: 'Under review',
  approved: 'Disetujui',
}

const fieldClass = 'w-full rounded border border-gray-400 bg-transparent px-3 py-2 text-sm'

export default function ReviewCard({ note }: { note: ReviewNote }) {
  const e = note.lore_entries
  const href = `/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`

  return (
    <article className="space-y-3 rounded border border-gray-400 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={href} className="font-semibold underline">
          {e.title}
        </Link>
        <span className="rounded bg-gray-500/20 px-2 py-0.5 text-xs">
          {statusLabel[note.status]}
        </span>
      </div>

      {note.content_blocks && (
        <p className="border-l-2 border-gray-400 pl-3 text-sm opacity-70">
          {note.content_blocks.body.slice(0, 200)}
        </p>
      )}

      <p className="text-xs opacity-60">
        Diajukan oleh {note.profiles.username} · ▲ {note.note_votes.length} dukungan
      </p>
      <p className="whitespace-pre-line">{note.body}</p>

      {note.evidence_text && (
        <p className="text-sm opacity-80">
          <span className="font-medium">Bukti:</span> {note.evidence_text}
        </p>
      )}

      <Attachments items={note.note_attachments} />

      {note.edited_at && <p className="text-xs opacity-50">disunting lorekeeper</p>}

      {note.status === 'submitted' && (
        <form action={startReview}>
          <input type="hidden" name="postId" value={note.id} />
          <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
            Mulai Review
          </button>
        </form>
      )}

      {note.status === 'under_review' && (
        <div className="space-y-3">
          <form action={approveNote}>
            <input type="hidden" name="postId" value={note.id} />
            <button type="submit" className="rounded bg-green-600 px-3 py-1.5 text-sm text-white">
              Setujui
            </button>
          </form>

          <form action={rejectNote} className="space-y-2">
            <input type="hidden" name="postId" value={note.id} />
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={1000}
              rows={2}
              placeholder="Alasan penolakan (wajib)"
              className={fieldClass}
            />
            <button type="submit" className="rounded bg-red-600 px-3 py-1.5 text-sm text-white">
              Tolak
            </button>
          </form>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer underline">Edit teks catatan</summary>
        <form action={editNote} className="mt-2 space-y-2">
          <input type="hidden" name="postId" value={note.id} />
          <textarea
            name="body"
            required
            maxLength={2000}
            rows={3}
            defaultValue={note.body}
            className={fieldClass}
          />
          <button type="submit" className="rounded border border-gray-400 px-3 py-1.5">
            Simpan
          </button>
        </form>
      </details>
    </article>
  )
}