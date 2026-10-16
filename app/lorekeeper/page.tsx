import { Suspense } from 'react'
import { requireLorekeeper } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ReviewCard, { type ReviewNote } from '@/components/ReviewCard'

// const SELECT =
//   'id, status, body, evidence_text, created_at, edited_at, profiles!author_id(username), content_blocks(body), lore_entries(title, slug, note_votes(user_id), subsections(slug, regions(slug)))'

  const SELECT =
  'id, status, body, evidence_text, created_at, edited_at, note_votes(user_id), profiles!author_id(username), content_blocks(body), lore_entries(title, slug, subsections(slug, regions(slug))), note_attachments(id, file_path, file_name, file_type)'

async function LorekeeperContent() {
  const user = await requireLorekeeper()
  const supabase = await createClient()

  const { data: pending } = await supabase
    .from('community_posts')
    .select(SELECT)
    .eq('type', 'note')
    .in('status', ['submitted', 'under_review'])
    .order('created_at', { ascending: true })

  const { data: approved } = await supabase
    .from('community_posts')
    .select(SELECT)
    .eq('type', 'note')
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(20)

  const pendingNotes = ((pending ?? []) as unknown as ReviewNote[]).sort(
    (a, b) =>
      b.note_votes.length - a.note_votes.length ||
      a.created_at.localeCompare(b.created_at)
  )
  const approvedNotes = (approved ?? []) as unknown as ReviewNote[]

  return (
    <>
      <h1 className="text-2xl font-bold">Panel Lorekeeper</h1>
      <p className="mt-1 text-sm opacity-70">Halo, {user.username}.</p>

      <h2 className="mb-3 mt-8 text-lg font-semibold">
        Antrian review ({pendingNotes.length})
      </h2>
      {pendingNotes.length === 0 ? (
        <p className="text-sm opacity-70">Tidak ada note yang menunggu.</p>
      ) : (
        <div className="space-y-4">
          {pendingNotes.map((n) => (
            <ReviewCard key={n.id} note={n} />
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold">Sudah disetujui (20 terbaru)</h2>
      {approvedNotes.length === 0 ? (
        <p className="text-sm opacity-70">Belum ada.</p>
      ) : (
        <div className="space-y-4">
          {approvedNotes.map((n) => (
            <ReviewCard key={n.id} note={n} />
          ))}
        </div>
      )}
    </>
  )
}

export default function LorekeeperPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <Suspense fallback={<p>Memuat...</p>}>
        <LorekeeperContent />
      </Suspense>
    </main>
  )
}