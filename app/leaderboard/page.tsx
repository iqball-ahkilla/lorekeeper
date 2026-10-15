import { Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Row = { user_id: string; username: string; approved_notes: number }

async function LeaderboardContent() {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('user_id, username, approved_notes')
    .order('approved_notes', { ascending: false })
    .order('username', { ascending: true })
    .limit(20)

  if (error) return <p>Gagal memuat leaderboard.</p>

  const rows = (data ?? []) as Row[]
  if (rows.length === 0) {
    return <p className="text-sm opacity-70">Belum ada catatan yang disetujui.</p>
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
    <ol className="space-y-2">
      {ranked.map((r) => (
        <li
          key={r.user_id}
          className="flex items-center justify-between rounded border border-gray-400 px-4 py-3"
        >
          <span className="flex items-center gap-3">
            <span className="w-6 text-right font-bold opacity-60">{r.rank}</span>
            <Link href={`/profile/${r.user_id}`} className="font-medium underline">
              {r.username}
            </Link>
          </span>
          <span className="text-sm">{r.approved_notes} catatan disetujui</span>
        </li>
      ))}
    </ol>
  )
}

export default function LeaderboardPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="mb-1 text-2xl font-bold">Kontributor Teratas</h1>
      <p className="mb-6 text-sm opacity-70">
        Diurutkan berdasarkan jumlah catatan komunitas yang disetujui lorekeeper.
      </p>
      <Suspense fallback={<p>Memuat...</p>}>
        <LeaderboardContent />
      </Suspense>
    </main>
  )
}