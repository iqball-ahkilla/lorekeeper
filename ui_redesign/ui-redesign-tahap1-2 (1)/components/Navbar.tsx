import Link from 'next/link'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/actions/auth'
import { ChevronDownIcon, SearchIcon } from '@/components/Icons'

const NAV_LINK =
  'rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-fg'
const MENU_LINK =
  'block rounded px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2'

export default async function Navbar() {
  await connection() // Navbar baru dirender saat ada request

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

  const isLorekeeper = profile?.role === 'lorekeeper'

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
      <div className="page flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-serif text-xl font-semibold tracking-wide text-gold">
            Lore Wiki
          </Link>

          <nav className="hidden items-center gap-1 sm:flex" aria-label="Navigasi utama">
            <Link href="/" className={NAV_LINK}>
              Beranda
            </Link>
            <Link href="/leaderboard" className={NAV_LINK}>
              Leaderboard
            </Link>
            <Link href="/search" className={`${NAV_LINK} inline-flex items-center gap-1.5`}>
              <SearchIcon className="h-3.5 w-3.5" />
              Cari
            </Link>
          </nav>
        </div>

        {profile ? (
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface [&::-webkit-details-marker]:hidden">
              <span className="max-w-[10rem] truncate font-medium">{profile.username}</span>
              {isLorekeeper && (
                <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                  lorekeeper
                </span>
              )}
              <ChevronDownIcon className="h-3.5 w-3.5 text-muted transition-transform group-open:rotate-180" />
            </summary>

            <div className="card absolute right-0 z-50 mt-2 w-56 p-1.5 shadow-xl shadow-black/40">
              <Link href={`/profile/${userId}`} className={MENU_LINK}>
                Profil saya
              </Link>
              <Link href="/catatan-saya" className={MENU_LINK}>
                Catatan saya
              </Link>

              {isLorekeeper && (
                <>
                  <p className="eyebrow px-3 pb-1 pt-3">Lorekeeper</p>
                  <Link href="/lorekeeper" className={MENU_LINK}>
                    Panel review
                  </Link>
                  <Link href="/lorekeeper/konten" className={MENU_LINK}>
                    Kelola konten
                  </Link>
                  <Link href="/lorekeeper/riwayat" className={MENU_LINK}>
                    Riwayat aktivitas
                  </Link>
                </>
              )}

              <form action={signOut} className="mt-1 border-t border-line pt-1">
                <button type="submit" className={`${MENU_LINK} w-full text-left text-rose`}>
                  Keluar
                </button>
              </form>
            </div>
          </details>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost py-1.5">
              Masuk
            </Link>
            <Link href="/signup" className="btn-gold py-1.5">
              Daftar
            </Link>
          </div>
        )}

        {/* Menu navigasi untuk layar kecil: satu baris di bawah logo */}
        <nav
          className="-mx-1 flex w-full items-center gap-1 overflow-x-auto sm:hidden"
          aria-label="Navigasi utama (ponsel)"
        >
          <Link href="/" className={NAV_LINK}>
            Beranda
          </Link>
          <Link href="/leaderboard" className={NAV_LINK}>
            Leaderboard
          </Link>
          <Link href="/search" className={NAV_LINK}>
            Cari
          </Link>
        </nav>
      </div>
    </header>
  )
}
