import { Suspense } from 'react'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Attachments, { type Attachment } from '@/components/Attachments'
import RelativeTime from '@/components/RelativeTime'
import Breadcrumb from '@/components/Breadcrumb'
import Avatar from '@/components/Avatar'
import { excerpt } from '@/lib/text'

type SearchParams = Promise<{ status?: string | string[] }>

type NoteStatus = 'submitted' | 'under_review' | 'approved' | 'rejected'

type MyNote = {
  id: string
  status: NoteStatus
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
  note_votes: { user_id: string }[]
}

const STATUS: Record<NoteStatus, { label: string; className: string }> = {
  submitted: { label: 'Menunggu review', className: 'bg-white/10 text-muted' },
  under_review: { label: 'Sedang direview', className: 'bg-amber-400/15 text-amber-300' },
  approved: { label: 'Disetujui', className: 'bg-emerald-500/15 text-emerald-300' },
  rejected: { label: 'Ditolak', className: 'bg-rose/15 text-rose' },
}

const TABS = [
  { key: undefined, label: 'Semua' },
  { key: 'submitted', label: 'Menunggu' },
  { key: 'under_review', label: 'Direview' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
] as const

async function MyNotesContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser()
  const raw = (await searchParams).status
  const param = Array.isArray(raw) ? raw[0] : raw
  const active = (['submitted', 'under_review', 'approved', 'rejected'] as const).find(
    (s) => s === param
  )

  const supabase = await createClient()

  const { data } = await supabase
    .from('community_posts')
    .select(
      'id, status, body, evidence_text, rejection_reason, created_at, content_blocks(body), lore_entries(title, slug, subsections(slug, regions(slug))), note_attachments(id, file_path, file_name, file_type), note_votes(user_id)'
    )
    .eq('author_id', user.id)
    .eq('type', 'note')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const all = (data ?? []) as unknown as MyNote[]
  const count = (s: NoteStatus) => all.filter((n) => n.status === s).length
  const shown = active ? all.filter((n) => n.status === active) : all

  const stats = [
    { label: 'Diajukan', value: all.length, className: 'text-fg' },
    { label: 'Disetujui', value: count('approved'), className: 'text-emerald-300' },
    { label: 'Dalam review', value: count('submitted') + count('under_review'), className: 'text-amber-300' },
    { label: 'Ditolak', value: count('rejected'), className: 'text-rose' },
  ]

  return (
    <>
      <Breadcrumb items={[{ label: 'Beranda', href: '/' }, { label: 'Catatan saya' }]} />

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Ruang pribadi</p>
          <h1 className="mt-1 font-serif text-4xl font-semibold text-gold">Catatan Saya</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Pantau status catatan komunitas yang kamu ajukan dan baca alasan penolakan dari
            lorekeeper. Halaman ini hanya bisa dilihat olehmu.
          </p>
        </div>
        <Link href="/" className="btn-gold self-start sm:self-auto">
          Cari lore untuk dicatat
        </Link>
      </header>

      <section className="card mt-8 flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4 lg:w-72">
          <Avatar name={user.username} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-serif text-xl font-semibold text-fg">{user.username}</p>
            <p className="mt-0.5 text-xs uppercase tracking-wider text-gold-dim">
              {user.role === 'lorekeeper' ? 'Lorekeeper' : 'Anggota'}
            </p>
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col-reverse rounded-md border border-line bg-deep/50 px-4 py-3"
            >
              <dt className="eyebrow text-muted">{s.label}</dt>
              <dd className={`font-serif text-2xl font-semibold ${s.className}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav
        className="mt-8 flex gap-1 overflow-x-auto rounded-lg border border-line bg-deep/60 p-1 sm:inline-flex"
        aria-label="Saring catatan"
      >
        {TABS.map((t) => {
          const on = t.key === active
          const n = t.key ? count(t.key) : all.length
          return (
            <Link
              key={t.label}
              href={t.key ? `/catatan-saya?status=${t.key}` : '/catatan-saya'}
              aria-current={on ? 'page' : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                on ? 'bg-surface-2 text-gold' : 'text-muted hover:text-fg'
              }`}
            >
              {t.label} ({n})
            </Link>
          )
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="card mt-6 p-6 text-sm text-muted">
          {all.length === 0 ? (
            <>
              Kamu belum pernah mengajukan catatan.{' '}
              <Link href="/" className="text-gold underline">
                Jelajahi lore
              </Link>{' '}
              dan ajukan yang pertama.
            </>
          ) : (
            'Tidak ada catatan dengan status ini.'
          )}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {shown.map((n) => {
            const e = n.lore_entries
            const href = `/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`
            const info = STATUS[n.status]

            return (
              <article
                key={n.id}
                className={`card space-y-3 p-5 ${n.status === 'rejected' ? 'border-t-2 border-t-rose' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={href}
                    className="font-serif text-lg font-semibold text-fg hover:text-gold"
                  >
                    {e.title}
                  </Link>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${info.className}`}>
                    {info.label}
                  </span>
                </div>

                {n.content_blocks && (
                  <p className="border-l-2 border-line pl-3 text-sm text-faint">
                    {excerpt(n.content_blocks.body, 200)}
                  </p>
                )}

                <p className="whitespace-pre-line leading-relaxed text-fg/90">{n.body}</p>

                {n.evidence_text && (
                  <div className="rounded-md border border-line bg-deep p-3 text-sm">
                    <p className="eyebrow">Bukti</p>
                    <p className="mt-1 leading-relaxed text-muted">{n.evidence_text}</p>
                  </div>
                )}

                <Attachments items={n.note_attachments} />

                {n.status === 'rejected' && n.rejection_reason && (
                  <div className="rounded-md border border-rose/40 bg-rose/10 p-4 text-sm">
                    <p className="eyebrow text-rose">Alasan penolakan (hanya terlihat olehmu)</p>
                    <p className="mt-2 whitespace-pre-line leading-relaxed text-fg">
                      {n.rejection_reason}
                    </p>
                    <p className="mt-3 text-xs text-muted">
                      Catatan yang ditolak tidak bisa diedit. Untuk merevisi, ajukan catatan baru
                      di entri yang sama.
                    </p>
                    <Link href={href} className="link-gold mt-2">
                      Buka entri untuk mengajukan catatan baru
                    </Link>
                  </div>
                )}

                <p className="flex flex-wrap gap-x-3 text-xs text-faint">
                  <span>
                    Diajukan <RelativeTime iso={n.created_at} />
                  </span>
                  <span>▲ {n.note_votes.length} dukungan</span>
                </p>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

export default function MyNotesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="page flex-1 py-8 sm:py-10">
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <MyNotesContent searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
