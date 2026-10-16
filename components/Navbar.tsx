import Link from 'next/link'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'

export default async function Navbar() {

  await connection()   // <- baris baru: Navbar baru dirender saat ada request

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub

  let profile: { username: string; role: string } | null = null
  if (userId) {
    const { data: row } = await supabase
      .from('profiles')
      .select('username, role')
      .eq('id', userId)
      .maybeSingle()
    profile = row
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-300 px-8">

    <nav className="flex items-center gap-4">
      <Link href="/" className="font-bold">Lore Wiki</Link>
      <Link href="/leaderboard" className="text-sm underline">Leaderboard</Link>
      <Link href="/search" className="text-sm underline">Cari</Link>
    </nav>

      {profile ? (
        <div className="flex items-center gap-4 text-sm">

          <Link href="/catatan-saya" className="underline">Catatan saya</Link>

          {profile.role === 'lorekeeper' && (
            <Link href="/lorekeeper" className="underline">Panel</Link>
          )}
          
          <span>
            <Link href={`/profile/${userId}`} className="underline">{profile.username}</Link>
            {profile.role === 'lorekeeper' && (
              <span className="ml-2 rounded bg-yellow-500/20 px-2 py-0.5 text-yellow-600">
                lorekeeper
              </span>
            )}
          </span>
          <form action={signOut}>
            <button type="submit" className="underline">Keluar</button>
          </form>
        </div>
      ) : (
        <div className="flex gap-4 text-sm">
          <Link href="/login" className="underline">Masuk</Link>
          <Link href="/signup" className="underline">Daftar</Link>
        </div>
      )}
    </header>
  )
}