import { Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'

type Row = { user_id: string; username: string; approved_notes: number }

async function LeaderboardContent() {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('user_id, username, approved_notes')
    .order('approved_notes', { ascending: false })
    .order('username', { ascending: true })
    .limit(20)

  if (error) return <p className="card p-6 text-sm text-rose">Gagal memuat leaderboard.</p>

  const rows = (data ?? []) as Row[]
  if (rows.length === 0) {
    return <p className="card p-6 text-sm text-muted">Belum ada catatan yang disetujui.</p>
  }

  // Skor sama berarti peringkat sama
  let lastCount = -1
  let lastRank = 0
  const ranked = rows.map((r, i) => {
    if (r.approved_notes !== lastCount) {
      lastRank = i + 1
      lastCount = r.approved_notes
    }
    return { ...r, rank: lastRank }
  })

  return (
    <ol className="space-y-3">
      {ranked.map((r) => (
        <li key={r.user_id}>
          <Link
            href={`/profile/${r.user_id}`}
            className={`card flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface-2 ${
              r.rank <= 3 ? 'border-gold/40' : ''
            }`}
          >
            <span className="flex min-w-0 items-center gap-4">
              <span
                className={`w-8 text-center font-serif text-2xl font-semibold ${
                  r.rank <= 3 ? 'text-gold' : 'text-faint'
                }`}
              >
                {r.rank}
              </span>
              <Avatar name={r.username} size="sm" />
              <span className="truncate font-medium text-fg">{r.username}</span>
            </span>
            <span className="shrink-0 text-sm text-muted">
              <span className="font-semibold text-gold">{r.approved_notes}</span> catatan
              disetujui
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

export default function LeaderboardPage() {
  return (
    <main className="page max-w-3xl flex-1 py-8 sm:py-10">
      <header className="mb-8">
        <p className="eyebrow">Peringkat komunitas</p>
        <h1 className="mt-1 font-serif text-4xl font-semibold text-fg">Kontributor Teratas</h1>
        <p className="mt-2 text-sm text-muted">
          Diurutkan berdasarkan jumlah catatan komunitas yang disetujui lorekeeper. Skor yang
          sama berbagi peringkat yang sama.
        </p>
      </header>
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <LeaderboardContent />
      </Suspense>
    </main>
  )
}
