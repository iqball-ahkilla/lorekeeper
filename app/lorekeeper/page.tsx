import { Suspense } from 'react'
import Link from 'next/link'
import { requireLorekeeper } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ReviewCard, { STATUS_LABEL, type ReviewNote } from '@/components/ReviewCard'
import Breadcrumb from '@/components/Breadcrumb'
import Avatar from '@/components/Avatar'
import { SearchIcon } from '@/components/Icons'
import { excerpt } from '@/lib/text'

import type { LinkTarget } from '@/components/LinkTextarea'

type SearchParams = Promise<{
  tab?: string | string[]
  q?: string | string[]
  urut?: string | string[]
  catatan?: string | string[]
}>

const SELECT =
  'id, status, body, evidence_text, created_at, edited_at, note_votes(user_id), profiles!author_id(username), content_blocks(body), lore_entries(title, slug, subsections(slug, regions(slug))), note_attachments(id, file_path, file_name, file_type)'

const TABS = [
  { key: undefined, label: 'Semua' },
  { key: 'menunggu', label: 'Menunggu' },
  { key: 'direview', label: 'Direview' },
  { key: 'disetujui', label: 'Disetujui' },
] as const

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

async function LorekeeperContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireLorekeeper()
  const sp = await searchParams
  const tabParam = first(sp.tab)
  const tab = TABS.find((t) => t.key === tabParam)?.key
  const q = (first(sp.q) ?? '').trim().slice(0, 50)
  const urut = first(sp.urut) === 'baru' ? 'baru' : 'dukungan'
  const selectedId = first(sp.catatan)

  const supabase = await createClient()
  const head = { count: 'exact', head: true } as const

  const [pendingRes, approvedRes, targetRes, approvedTotal, rejectedTotal] = await Promise.all([
    supabase
      .from('community_posts')
      .select(SELECT)
      .eq('type', 'note')
      .is('deleted_at', null)
      .in('status', ['submitted', 'under_review'])
      .order('created_at', { ascending: true }),
    supabase
      .from('community_posts')
      .select(SELECT)
      .eq('type', 'note')
      .is('deleted_at', null)
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false })
      .limit(20),
    supabase.from('link_targets').select('path, label, kind, search_text'),
    supabase
      .from('community_posts')
      .select('id', head)
      .eq('type', 'note')
      .eq('status', 'approved')
      .is('deleted_at', null),
    supabase
      .from('community_posts')
      .select('id', head)
      .eq('type', 'note')
      .eq('status', 'rejected')
      .is('deleted_at', null),
  ])

  const targets = (targetRes.data ?? []) as LinkTarget[]
  const pendingNotes = (pendingRes.data ?? []) as unknown as ReviewNote[]
  const approvedNotes = (approvedRes.data ?? []) as unknown as ReviewNote[]

  const submittedCount = pendingNotes.filter((n) => n.status === 'submitted').length
  const underReviewCount = pendingNotes.filter((n) => n.status === 'under_review').length
  const decided = (approvedTotal.count ?? 0) + (rejectedTotal.count ?? 0)
  const approvalRate = decided > 0 ? Math.round(((approvedTotal.count ?? 0) / decided) * 100) : null

  const stats = [
    { label: 'Menunggu review', value: String(submittedCount) },
    { label: 'Sedang direview', value: String(underReviewCount) },
    { label: 'Tingkat persetujuan', value: approvalRate === null ? '–' : `${approvalRate}%` },
  ]

  // Daftar antrean sesuai tab, pencarian, dan urutan
  let list = [...pendingNotes, ...approvedNotes]
  if (tab === 'menunggu') list = list.filter((n) => n.status === 'submitted')
  if (tab === 'direview') list = list.filter((n) => n.status === 'under_review')
  if (tab === 'disetujui') list = list.filter((n) => n.status === 'approved')

  if (q) {
    const needle = q.toLowerCase()
    list = list.filter(
      (n) =>
        n.lore_entries.title.toLowerCase().includes(needle) ||
        n.profiles.username.toLowerCase().includes(needle) ||
        n.body.toLowerCase().includes(needle)
    )
  }

  // Yang belum diputuskan tampil di atas yang sudah disetujui; di dalam kelompok diurutkan
  const group = (n: ReviewNote) => (n.status === 'approved' ? 1 : 0)
  list.sort(
    (a, b) =>
      group(a) - group(b) ||
      (urut === 'baru'
        ? b.created_at.localeCompare(a.created_at)
        : b.note_votes.length - a.note_votes.length || a.created_at.localeCompare(b.created_at))
  )

  const selected = list.find((n) => n.id === selectedId) ?? list[0]

  // Susun alamat dengan mempertahankan filter yang sedang aktif
  const url = (o: { tab?: string; q?: string; urut?: string; catatan?: string }) => {
    const p = new URLSearchParams()
    const t = 'tab' in o ? o.tab : tab
    const qq = 'q' in o ? o.q : q
    const u = 'urut' in o ? o.urut : urut === 'baru' ? 'baru' : undefined
    if (t) p.set('tab', t)
    if (qq) p.set('q', qq)
    if (u) p.set('urut', u)
    if (o.catatan) p.set('catatan', o.catatan)
    const s = p.toString()
    return `/lorekeeper${s ? `?${s}` : ''}`
  }

  return (
    <>
      <Breadcrumb items={[{ label: 'Beranda', href: '/' }, { label: 'Panel review' }]} />

      <header className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Panel lorekeeper · {user.username}</p>
          <h1 className="mt-1 font-serif text-4xl font-semibold text-fg">Antrean Review</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Periksa catatan komunitas, sunting bila perlu, lalu setujui atau tolak dengan
            alasan.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="card flex flex-col-reverse px-4 py-3">
              <dt className="eyebrow text-muted">{s.label}</dt>
              <dd className="font-serif text-2xl font-semibold text-gold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Antrean */}
        <section aria-label="Antrean catatan">
          <nav
            className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-deep/60 p-1"
            aria-label="Saring antrean"
          >
            {TABS.map((t) => {
              const on = t.key === tab
              return (
                <Link
                  key={t.label}
                  href={url({ tab: t.key })}
                  aria-current={on ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                    on ? 'bg-surface-2 text-gold' : 'text-muted hover:text-fg'
                  }`}
                >
                  {t.label}
                </Link>
              )
            })}
          </nav>

          <form action="/lorekeeper" className="mt-3 flex flex-wrap items-center gap-2">
            {tab && <input type="hidden" name="tab" value={tab} />}
            {urut === 'baru' && <input type="hidden" name="urut" value="baru" />}
            <div className="card flex min-w-0 flex-1 items-center gap-2 px-3">
              <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Cari judul, penulis, atau isi…"
                aria-label="Cari catatan"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-fg placeholder:text-faint focus:outline-none"
              />
            </div>
            <button type="submit" className="btn-ghost">
              Cari
            </button>
          </form>

          <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            Urutkan:
            <Link
              href={url({ urut: undefined })}
              className={urut === 'dukungan' ? 'font-semibold text-gold' : 'hover:text-fg'}
            >
              Dukungan terbanyak
            </Link>
            ·
            <Link
              href={url({ urut: 'baru' })}
              className={urut === 'baru' ? 'font-semibold text-gold' : 'hover:text-fg'}
            >
              Terbaru
            </Link>
          </p>

          {list.length === 0 ? (
            <p className="card mt-4 p-6 text-sm text-muted">
              {pendingNotes.length === 0 && approvedNotes.length === 0
                ? 'Belum ada catatan di antrean.'
                : 'Tidak ada catatan yang cocok dengan filter ini.'}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {list.map((n) => {
                const on = n.id === selected?.id
                const st = STATUS_LABEL[n.status]
                return (
                  <li key={n.id}>
                    <Link
                      href={`${url({ catatan: n.id })}#detail`}
                      aria-current={on ? 'true' : undefined}
                      className={`card flex gap-3 p-4 transition-colors hover:bg-surface-2 ${
                        on ? 'border-gold/60 bg-surface-2' : ''
                      }`}
                    >
                      <span className="flex w-12 shrink-0 flex-col items-center justify-center rounded-md border border-line bg-deep/60 py-1.5">
                        <span className="font-serif text-lg font-semibold text-gold">
                          {n.note_votes.length}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-faint">
                          suara
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="truncate font-serif text-base font-semibold text-fg">
                            {n.lore_entries.title}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${st.className}`}
                          >
                            {st.label}
                          </span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted">
                          {excerpt(n.body, 160)}
                        </span>
                        <span className="mt-2 flex items-center gap-2 text-xs text-faint">
                          <Avatar name={n.profiles.username} size="sm" />
                          {n.profiles.username}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {approvedNotes.length === 20 && (
            <p className="mt-3 text-xs text-faint">
              Catatan yang sudah disetujui hanya menampilkan 20 yang terbaru.
            </p>
          )}
        </section>

        {/* Pemeriksaan */}
        <section id="detail" className="scroll-mt-24" aria-label="Pemeriksaan catatan">
          {selected ? (
            <ReviewCard key={selected.id} note={selected} targets={targets} />
          ) : (
            <p className="card p-6 text-sm text-muted">
              Pilih catatan dari antrean untuk memeriksanya.
            </p>
          )}
        </section>
      </div>
    </>
  )
}

export default function LorekeeperPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="page flex-1 py-8 sm:py-10">
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <LorekeeperContent searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
