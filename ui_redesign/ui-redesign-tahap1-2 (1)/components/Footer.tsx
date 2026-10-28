import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-deep/60">
      <div className="page flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <p className="font-serif text-lg font-semibold text-gold">Lore Wiki</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Wiki lore komunitas. Lore resmi dipisahkan dengan jelas dari catatan komunitas,
            dan setiap catatan harus disertai bukti sebelum ditampilkan.
          </p>
        </div>

        <nav className="flex gap-8 text-sm" aria-label="Tautan footer">
          <ul className="space-y-2">
            <li>
              <Link href="/" className="text-muted hover:text-fg">
                Beranda
              </Link>
            </li>
            <li>
              <Link href="/search" className="text-muted hover:text-fg">
                Cari lore
              </Link>
            </li>
            <li>
              <Link href="/leaderboard" className="text-muted hover:text-fg">
                Leaderboard
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <p className="page py-4 text-xs text-faint">
          Proyek tugas kuliah. Lore Genshin Impact adalah milik HoYoverse; situs ini tidak
          berafiliasi dengan HoYoverse.
        </p>
      </div>
    </footer>
  )
}
