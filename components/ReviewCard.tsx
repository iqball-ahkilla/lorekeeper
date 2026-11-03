import Link from 'next/link'
import { startReview, approveNote, rejectNote, editNote } from '@/app/actions/review'
import ActionForm from '@/components/ActionForm'
import Attachments, { type Attachment } from '@/components/Attachments'
import RelativeTime from '@/components/RelativeTime'
import LinkTextarea, { type LinkTarget } from '@/components/LinkTextarea'
import Avatar from '@/components/Avatar'
import { excerpt } from '@/lib/text'

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
  note_votes: { user_id: string }[]
  note_attachments: Attachment[]
}

export const STATUS_LABEL = {
  submitted: { label: 'Baru masuk', className: 'bg-white/10 text-muted' },
  under_review: { label: 'Sedang direview', className: 'bg-amber-400/15 text-amber-300' },
  approved: { label: 'Disetujui', className: 'bg-emerald-500/15 text-emerald-300' },
} as const

const fieldClass = 'field'

// Pola tautan yang sama dengan components/RichText.tsx
const LINK = /\[\[([a-z0-9-]+(?:\/[a-z0-9-]+){0,2})\|([^\]]+)\]\]/g

// Periksa tiap tautan [[path|teks]] di isi catatan terhadap daftar tujuan yang ada
function checkLinks(body: string, targets: LinkTarget[]) {
  const known = new Set(targets.map((t) => t.path))
  return [...body.matchAll(LINK)].map((m) => ({
    path: m[1],
    text: m[2],
    valid: known.has(m[1]),
  }))
}

export default function ReviewCard({
  note,
  targets,
}: {
  note: ReviewNote
  targets: LinkTarget[]
}) {
  const e = note.lore_entries
  const href = `/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`
  const isApproved = note.status === 'approved'
  const status = STATUS_LABEL[note.status]
  const links = checkLinks(note.body, targets)

  return (
    <article className="card space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Pemeriksaan catatan</p>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div>
        <Link
          href={href}
          className="font-serif text-2xl font-semibold leading-snug text-fg hover:text-gold"
        >
          {e.title}
        </Link>
        {note.content_blocks && (
          <p className="mt-2 border-l-2 border-line pl-3 text-sm text-faint">
            Melekat pada: {excerpt(note.content_blocks.body, 200)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-deep/50 px-4 py-3 text-sm">
        <span className="flex items-center gap-3">
          <Avatar name={note.profiles.username} size="sm" />
          <span>
            <span className="font-medium text-fg">{note.profiles.username}</span>
            <span className="block text-xs text-faint">
              Diajukan <RelativeTime iso={note.created_at} />
            </span>
          </span>
        </span>
        <span className="text-gold">▲ {note.note_votes.length} dukungan</span>
      </div>

      <div>
        <p className="eyebrow">Isi catatan</p>
        <p className="mt-2 whitespace-pre-line leading-relaxed text-fg/90">{note.body}</p>
        {note.edited_at && <p className="mt-2 text-xs text-faint">disunting lorekeeper</p>}
      </div>

      {links.length > 0 && (
        <div className="rounded-md border border-line bg-deep p-3 text-sm">
          <p className="eyebrow">Pemeriksaan tautan</p>
          <ul className="mt-2 space-y-1">
            {links.map((l, i) => (
              <li key={`${l.path}-${i}`} className="flex flex-wrap items-center gap-x-2">
                <span className="text-fg">{l.text}</span>
                <span className="font-mono text-xs text-faint">→ /lore/{l.path}</span>
                <span className={l.valid ? 'text-emerald-300' : 'text-rose'}>
                  {l.valid ? '✓ Valid' : '✗ Tujuan tidak ditemukan'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md border border-line bg-deep p-3 text-sm">
        <p className="eyebrow">Bukti</p>
        {note.evidence_text ? (
          <p className="mt-2 leading-relaxed text-muted">{note.evidence_text}</p>
        ) : (
          <p className="mt-2 text-faint">Tidak ada bukti teks.</p>
        )}
        <Attachments items={note.note_attachments} />
      </div>

      <p className="rounded-md border border-line bg-deep/60 p-3 text-xs leading-relaxed text-muted">
        <span className="font-semibold text-gold-dim">Alur:</span> catatan yang disetujui tampil
        di bawah paragraf terkait dan dihitung di leaderboard. Penolakan wajib disertai alasan
        yang hanya terlihat oleh penulis.
      </p>

      <div className="flex flex-wrap items-start gap-3">
        {note.status === 'submitted' && (
          <ActionForm action={startReview} submitLabel="Mulai review" className="space-y-1">
            <input type="hidden" name="postId" value={note.id} />
          </ActionForm>
        )}

        {note.status === 'under_review' && (
          <ActionForm
            action={approveNote}
            submitLabel="Setujui catatan"
            buttonClassName="btn-gold disabled:opacity-50"
            className="space-y-1"
          >
            <input type="hidden" name="postId" value={note.id} />
          </ActionForm>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-rose hover:underline">
          {isApproved ? 'Cabut persetujuan' : 'Tolak catatan'}
        </summary>
        <ActionForm
          action={rejectNote}
          submitLabel={isApproved ? 'Cabut persetujuan' : 'Tolak catatan'}
          buttonClassName="btn-danger disabled:opacity-50"
          className="mt-3 space-y-2"
        >
          <input type="hidden" name="postId" value={note.id} />
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            placeholder={
              isApproved
                ? 'Alasan mencabut persetujuan (wajib, terlihat oleh penulis)'
                : 'Alasan penolakan (wajib, terlihat oleh penulis)'
            }
            className={fieldClass}
          />
        </ActionForm>
      </details>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-gold hover:underline">
          Edit teks catatan
        </summary>
        <ActionForm action={editNote} submitLabel="Simpan" className="mt-3 space-y-2">
          <input type="hidden" name="postId" value={note.id} />
          <LinkTextarea
            name="body"
            defaultValue={note.body}
            targets={targets}
            rows={4}
            maxLength={2000}
            required
            className={fieldClass}
          />
          <p className="text-xs text-faint">
            Ketik <span className="font-mono">[[</span> untuk menyisipkan tautan ke halaman lore.
          </p>
        </ActionForm>
      </details>
    </article>
  )
}
