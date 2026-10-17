import { Suspense } from 'react'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

import Attachments, { type Attachment } from '@/components/Attachments'

import RelativeTime from '@/components/RelativeTime'

type MyNote = {
  id: string
  status: 'submitted' | 'under_review' | 'approved' | 'rejected'
  body: string
  evidence_text: string | null
  rejection_reason: string | null
  created_at: string
  content_blocks: { body: string } | null
  lore_entries: {
    title: string
    slug: string
    subsections: { slug: string; regions: { slug: string } }
  }
  note_attachments: Attachment[]
}

const statusInfo = {
  submitted: { label: 'Menunggu review', className: 'bg-gray-500/20' },
  under_review: { label: 'Sedang direview', className: 'bg-orange-500/20 text-orange-500' },
  approved: { label: 'Disetujui', className: 'bg-green-500/20 text-green-600' },
  rejected: { label: 'Ditolak', className: 'bg-red-500/20 text-red-500' },
}

// function formatDate(iso: string) {
//   return new Date(iso).toLocaleDateString('id-ID', {
//     day: 'numeric',
//     month: 'short',
//     year: 'numeric',
//   })
// }

async function MyNotesContent() {
  const user = await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('community_posts')
    .select(
      'id, status, body, evidence_text, rejection_reason, created_at, content_blocks(body), lore_entries(title, slug, subsections(slug, regions(slug))), note_attachments(id, file_path, file_name, file_type)'
    )
    .eq('author_id', user.id)
    .eq('type', 'note')
    .order('created_at', { ascending: false })

  const notes = (data ?? []) as unknown as MyNote[]

  return (
    <>
      <h1 className="text-2xl font-bold">Catatan saya</h1>
      <p className="mt-1 text-sm opacity-70">
        Halaman ini hanya bisa dilihat olehmu.
      </p>

      {notes.length === 0 ? (
        <p className="mt-6 text-sm">
          Kamu belum pernah mengajukan catatan.{' '}
          <Link href="/" className="underline">Jelajahi lore</Link> dan ajukan yang pertama.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {notes.map((n) => {
            const e = n.lore_entries
            const href = `/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`
            const info = statusInfo[n.status]

            return (
              <article key={n.id} className="space-y-3 rounded border border-gray-400 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Link href={href} className="font-semibold underline">{e.title}</Link>
                  <span className={`rounded px-2 py-0.5 text-xs ${info.className}`}>
                    {info.label}
                  </span>
                </div>

                {n.content_blocks && (
                  <p className="border-l-2 border-gray-400 pl-3 text-sm opacity-70">
                    {n.content_blocks.body.slice(0, 200)}
                  </p>
                )}

                <p className="whitespace-pre-line">{n.body}</p>

                {n.evidence_text && (
                  <p className="text-sm opacity-80">
                    <span className="font-medium">Bukti:</span> {n.evidence_text}
                  </p>
                )}

                <Attachments items={n.note_attachments} />

                {n.status === 'rejected' && n.rejection_reason && (
                  <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm">
                    <p className="font-medium text-red-500">Alasan penolakan</p>
                    <p className="mt-1 whitespace-pre-line">{n.rejection_reason}</p>
                  </div>
                )}

                <p className="text-xs opacity-50">Diajukan <RelativeTime iso={n.created_at} /></p>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

export default function MyNotesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <Suspense fallback={<p>Memuat...</p>}>
        <MyNotesContent />
      </Suspense>
    </main>
  )
}