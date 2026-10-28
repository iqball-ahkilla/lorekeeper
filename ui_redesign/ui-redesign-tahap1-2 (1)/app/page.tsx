import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'
import RelativeTime from '@/components/RelativeTime'
import { ArrowRightIcon, BookIcon, ClockIcon, SearchIcon } from '@/components/Icons'
import { excerpt, readMinutes } from '@/lib/text'
import { formatDateWIB } from '@/lib/time'

type SearchParams = Promise<{ jenis?: string | string[] }>

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="hero-bg border-b border-line">
      <div className="page py-16 sm:py-24">
        <span className="chip border-gold/30 text-gold">
          <BookIcon className="mr-1.5 h-3 w-3" />
          Arsip lore · disusun komunitas
        </span>

        <h1 className="mt-5 max-w-2xl font-serif text-4xl font-semibold leading-tight text-fg sm:text-5xl">
          Telusuri Kisah yang Tersimpan di Teyvat
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Lore resmi dipisahkan dengan jelas dari catatan komunitas. Setiap catatan harus
          disertai bukti dan ditinjau lorekeeper sebelum tampil di bawah paragraf lore.
        </p>

        <form action="/search" className="card mt-8 max-w-xl p-2">
          <div className="flex items-center gap-2">
            <SearchIcon className="ml-2 h-4 w-4 shrink-0 text-muted" />
            <input
              type="search"
              name="q"
              minLength={2}
              placeholder="Cari wilayah, sub-bagian, atau judul lore…"
              aria-label="Cari lore"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-fg placeholder:text-faint focus:outline-none"
            />
            <button type="submit" className="btn-gold shrink-0">
              Cari
            </button>
          </div>
        </form>

        <Link href="#arsip" className="link-gold mt-5">
          Jelajahi arsip wilayah <ArrowRightIcon />
        </Link>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Statistik                                                           */
/* ------------------------------------------------------------------ */

async function Stats() {
  const supabase = await createClient()
  const head = { count: 'exact', head: true } as const

  const [regions, entries, notes, members] = await Promise.all([
    supabase.from('regions').select('id', head).eq('kind', 'region').eq('status', 'published'),
    supabase.from('lore_entries').select('id', head).eq('status', 'published'),
    supabase
      .from('community_posts')
      .select('id', head)
      .eq('type', 'note')
      .eq('status', 'approved')
      .is('deleted_at', null),
    supabase.from('profiles').select('id', head),
  ])

  const items = [
    { label: 'Wilayah', value: regions.count },
    { label: 'Entri lore', value: entries.count },
    { label: 'Catatan disetujui', value: notes.count },
    { label: 'Anggota', value: members.count },
  ]

  return (
    <dl className="card grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
      {items.map((s, i) => (
        <div
          key={s.label}
          className={`flex flex-col-reverse px-4 py-5 text-center ${i < 2 ? 'border-b border-line sm:border-b-0' : ''}`}
        >
          <dt className="eyebrow mt-1 text-muted">{s.label}</dt>
          <dd className="font-serif text-3xl font-semibold text-gold">{s.value ?? '–'}</dd>
        </div>
      ))}
    </dl>
  )
}

function StatsFallback() {
  return <div className="card h-[104px] animate-pulse" />
}

/* ------------------------------------------------------------------ */
/* Arsip wilayah & topik                                               */
/* ------------------------------------------------------------------ */

type Region = {
  name: string
  slug: string
  description: string | null
  kind: 'region' | 'topic'
  status: ContentStatus
  subsections: { status: ContentStatus; lore_entries: { status: ContentStatus }[] }[]
}

const TABS = [
  { key: undefined, label: 'Semua' },
  { key: 'wilayah', label: 'Wilayah' },
  { key: 'topik', label: 'Topik' },
] as const

function RegionCard({ r }: { r: Region }) {
  const subs = r.subsections.filter((s) => s.status === 'published')
  const entryCount = subs.reduce(
    (n, s) => n + s.lore_entries.filter((e) => e.status === 'published').length,
    0
  )

  return (
    <li>
      <Link
        href={`/lore/${r.slug}`}
        className="card group flex h-full flex-col p-5 transition-colors hover:border-gold/50 hover:bg-surface-2"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="eyebrow">{r.kind === 'region' ? 'Wilayah' : 'Topik'}</span>
          <StatusBadge status={r.status} hidePublished />
        </span>

        <span className="mt-2 font-serif text-xl font-semibold leading-snug text-fg">
          {r.name}
        </span>

        {r.description && (
          <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
            {r.description}
          </span>
        )}

        <span className="mt-auto flex items-center justify-between gap-2 pt-5 text-xs text-faint">
          <span>
            {entryCount} entri · {subs.length} sub-bagian
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-gold">
            Buka <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      </Link>
    </li>
  )
}

async function RegionSection({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).jenis
  const jenis = Array.isArray(raw) ? raw[0] : raw
  const active = jenis === 'wilayah' || jenis === 'topik' ? jenis : undefined

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('regions')
    .select('name, slug, description, kind, status, subsections(status, lore_entries(status))')
    .order('sort_order')

  if (error) return <p className="text-sm text-rose">Gagal memuat arsip: {error.message}</p>

  const all = (data ?? []) as unknown as Region[]
  const shown = all.filter(
    (r) => !active || r.kind === (active === 'wilayah' ? 'region' : 'topic')
  )

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Wilayah &amp; topik</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-fg">Arsip Teyvat</h2>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Telusuri lore menurut wilayah, atau menurut topik seperti senjata, artefak, dan
            faksi.
          </p>
        </div>

        <nav
          className="inline-flex self-start rounded-lg border border-line bg-deep/60 p-1 sm:self-auto"
          aria-label="Saring arsip"
        >
          {TABS.map((t) => {
            const on = t.key === active
            return (
              <Link
                key={t.label}
                href={t.key ? `/?jenis=${t.key}#arsip` : '/#arsip'}
                scroll={false}
                aria-current={on ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  on ? 'bg-surface-2 text-gold' : 'text-muted hover:text-fg'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {shown.length === 0 ? (
        <p className="card p-6 text-sm text-muted">Belum ada konten untuk ditampilkan.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((r) => (
            <RegionCard key={r.slug} r={r} />
          ))}
        </ul>
      )}
    </>
  )
}

function CardsFallback() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card h-44 animate-pulse" />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Entri terbaru                                                       */
/* ------------------------------------------------------------------ */

type LatestEntry = {
  title: string
  slug: string
  first_published_at: string
  subsections: { name: string; slug: string; regions: { name: string; slug: string } }
  content_blocks: { body: string; block_type: 'heading' | 'paragraph' | 'quote'; sort_order: number }[]
}

async function LatestEntries() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lore_entries')
    .select(
      'title, slug, first_published_at, subsections!inner(name, slug, regions!inner(name, slug)), content_blocks(body, block_type, sort_order)'
    )
    .eq('status', 'published')
    .eq('subsections.status', 'published')
    .eq('subsections.regions.status', 'published')
    .not('first_published_at', 'is', null)
    .order('first_published_at', { ascending: false })
    .order('sort_order', { referencedTable: 'content_blocks' })
    .limit(4)

  const rows = (data ?? []) as unknown as LatestEntry[]
  if (error || rows.length === 0) return null

  const [featured, ...rest] = rows
  const href = (e: LatestEntry) =>
    `/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`
  const firstOf = (e: LatestEntry, type: 'paragraph' | 'quote') =>
    e.content_blocks.find((b) => b.block_type === type)?.body
  const minutes = (e: LatestEntry) =>
    readMinutes(e.content_blocks.filter((b) => b.block_type !== 'heading').map((b) => b.body))

  const intro = firstOf(featured, 'paragraph')
  const quote = firstOf(featured, 'quote')

  return (
    <section>
      <div className="mb-6">
        <p className="eyebrow">Baru diterbitkan</p>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-fg">Entri Terbaru</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Entri utama */}
        <article className="card flex flex-col p-6 lg:col-span-3">
          <p className="text-xs text-faint">
            {featured.subsections.regions.name} / {featured.subsections.name}
          </p>
          <h3 className="mt-2 font-serif text-2xl font-semibold leading-snug text-fg sm:text-3xl">
            <Link href={href(featured)} className="hover:text-gold">
              {featured.title}
            </Link>
          </h3>

          {intro && (
            <p className="mt-3 leading-relaxed text-muted">{excerpt(intro, 320)}</p>
          )}

          {quote && (
            <blockquote className="mt-4 rounded-md border border-line bg-deep p-4">
              <p className="eyebrow">Kutipan dari entri</p>
              <p className="mt-2 text-sm italic leading-relaxed text-muted">
                “{excerpt(quote, 220)}”
              </p>
            </blockquote>
          )}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
            <p className="inline-flex items-center gap-1.5 text-xs text-faint">
              <ClockIcon className="h-3.5 w-3.5" />
              {minutes(featured)} menit baca · terbit {formatDateWIB(featured.first_published_at)}
            </p>
            <Link href={href(featured)} className="btn-gold">
              Baca entri
            </Link>
          </div>
        </article>

        {/* Entri lain */}
        {rest.length > 0 && (
          <div className="flex flex-col gap-4 lg:col-span-2">
            {rest.map((e) => {
              const p = firstOf(e, 'paragraph')
              return (
                <article key={href(e)} className="card flex flex-1 flex-col p-5">
                  <p className="text-xs text-faint">
                    {e.subsections.regions.name} / {e.subsections.name}
                  </p>
                  <h3 className="mt-1.5 font-serif text-lg font-semibold leading-snug text-fg">
                    <Link href={href(e)} className="hover:text-gold">
                      {e.title}
                    </Link>
                  </h3>
                  {p && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                      {excerpt(p, 140)}
                    </p>
                  )}
                  <Link href={href(e)} className="link-gold mt-auto pt-3">
                    Baca <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Catatan komunitas terbaru                                           */
/* ------------------------------------------------------------------ */

type RecentNote = {
  id: string
  body: string
  created_at: string
  profiles: { id: string; username: string } | null
  content_blocks: { body: string } | null
  lore_entries: {
    title: string
    slug: string
    subsections: { slug: string; regions: { slug: string } }
  } | null
}

async function RecentNotes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('community_posts')
    .select(
      'id, body, created_at, profiles!author_id(id, username), content_blocks(body), lore_entries(title, slug, subsections(slug, regions(slug)))'
    )
    .eq('type', 'note')
    .eq('status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(2)

  const notes = ((data ?? []) as unknown as RecentNote[]).filter((n) => n.lore_entries)
  if (error || notes.length === 0) return null

  return (
    <section>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Forum teori komunitas</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-fg">
            Catatan Komunitas Terbaru
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Catatan yang sudah disetujui lorekeeper. Isinya tetap teori atau spekulasi
            komunitas, bukan lore resmi.
          </p>
        </div>
        <p className="flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gold" /> Lore resmi
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky" /> Catatan komunitas
          </span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {notes.map((n) => {
          const e = n.lore_entries!
          const href = `/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`
          return (
            <article key={n.id} className="card flex flex-col p-5">
              <span className="chip self-start border-sky/30 text-sky">
                Catatan komunitas · disetujui
              </span>

              <h3 className="mt-3 font-serif text-lg font-semibold leading-snug text-fg">
                <Link href={href} className="hover:text-gold">
                  {e.title}
                </Link>
              </h3>

              {n.content_blocks && (
                <p className="mt-1 line-clamp-1 text-xs text-faint">
                  Melekat pada paragraf: “{excerpt(n.content_blocks.body, 80)}”
                </p>
              )}

              <p className="mt-3 border-l-2 border-gold-dim pl-3 text-sm italic leading-relaxed text-gold">
                {excerpt(n.body, 260)}
              </p>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-muted">
                <span>
                  {n.profiles ? (
                    <Link href={`/profile/${n.profiles.id}`} className="font-medium hover:text-gold">
                      {n.profiles.username}
                    </Link>
                  ) : (
                    'Anggota'
                  )}{' '}
                  · <RelativeTime iso={n.created_at} />
                </span>
                <Link href={href} className="link-gold">
                  Baca di entri <ArrowRightIcon className="h-3 w-3" />
                </Link>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Ajakan berkontribusi                                                */
/* ------------------------------------------------------------------ */

function ContributeBanner() {
  return (
    <section className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-xl">
        <h2 className="font-serif text-xl font-semibold text-fg">
          Menemukan sesuatu yang terlewat di lore?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Anggota dapat mengajukan catatan komunitas langsung di bawah paragraf lore, lengkap
          dengan bukti dari teks atau tangkapan layar dalam game. Lorekeeper akan
          meninjaunya sebelum ditampilkan.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href="/leaderboard" className="btn-ghost">
          Lihat leaderboard
        </Link>
        <Link href="/signup" className="btn-gold">
          Daftar jadi anggota
        </Link>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Halaman                                                             */
/* ------------------------------------------------------------------ */

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex-1">
      <Hero />

      <div className="page -mt-8 space-y-14 pb-4 sm:-mt-10">
        <Suspense fallback={<StatsFallback />}>
          <Stats />
        </Suspense>

        <div id="arsip" className="scroll-mt-24">
          <Suspense fallback={<CardsFallback />}>
            <RegionSection searchParams={searchParams} />
          </Suspense>
        </div>

        <Suspense fallback={<div className="card h-64 animate-pulse" />}>
          <LatestEntries />
        </Suspense>

        <Suspense fallback={<div className="card h-48 animate-pulse" />}>
          <RecentNotes />
        </Suspense>

        <ContributeBanner />
      </div>
    </main>
  )
}
