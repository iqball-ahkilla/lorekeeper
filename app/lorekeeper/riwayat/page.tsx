import { Suspense } from 'react'
import Link from 'next/link'
import { requireLorekeeper } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatWIB } from '@/lib/time'

const PAGE = 50

type SearchParams = Promise<{
  aksi?: string | string[]
  pelaku?: string | string[]
  sebelum?: string | string[]
}>

type LogRow = {
  id: string
  actor_id: string | null
  action: string
  target_type: string
  target_id: string | null
  details: Record<string, unknown>
  created_at: string
  profiles: { id: string; username: string } | null
}

type Target = { label: string; href: string | null }

type EntryRef = {
  title: string
  slug: string
  subsections: { slug: string; regions: { slug: string } }
}

type Client = Awaited<ReturnType<typeof createClient>>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

// Daftar putih: filter hanya boleh memakai awalan yang kita tentukan sendiri
const GROUPS = [
  { key: 'review', label: 'Review catatan', prefix: 'note.' },
  { key: 'komentar', label: 'Moderasi komentar', prefix: 'comment.' },
  { key: 'wilayah', label: 'Wilayah / Topik', prefix: 'region.' },
  { key: 'subsection', label: 'Sub-section', prefix: 'subsection.' },
  { key: 'entry', label: 'Entry', prefix: 'entry.' },
  { key: 'blok', label: 'Blok teks', prefix: 'block.' },
  { key: 'media', label: 'Media', prefix: 'media.' },
]

const NOTE_LABEL: Record<string, string> = {
  'note.start_review': 'memulai review catatan',
  'note.approve': 'menyetujui catatan',
  'note.reject': 'menolak catatan',
  'note.revoke': 'mencabut persetujuan catatan',
  'note.edit': 'menyunting teks catatan',
  'comment.delete': 'menghapus komentar member',
}

const TYPE_LABEL: Record<string, string> = {
  region: 'wilayah/topik',
  subsection: 'sub-section',
  entry: 'entry',
  block: 'blok',
  media: 'media',
}

const VERB_LABEL: Record<string, string> = {
  create: 'membuat',
  update: 'mengubah',
  edit: 'menyunting',
  publish: 'menerbitkan',
  archive: 'mengarsipkan',
  restore: 'memulihkan',
  move: 'menggeser',
  delete: 'menghapus',
}

const IMPACT_LABEL: Record<string, string> = {
  subsections: 'sub-section',
  entries: 'entry',
  blocks: 'blok',
  posts: 'komentar dan catatan',
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

function labelFor(action: string) {
  if (NOTE_LABEL[action]) return NOTE_LABEL[action]
  const [type, verb] = action.split('.')
  const t = TYPE_LABEL[type]
  const v = VERB_LABEL[verb]
  if (!t || !v) return action
  const permanent = verb === 'delete' && ['region', 'subsection', 'entry'].includes(type)
  return `${permanent ? 'menghapus permanen' : v} ${t}`
}

function detailText(d: Record<string, unknown>): string {
  const parts: string[] = []

  if (typeof d.name === 'string') parts.push(`“${d.name}”`)
  if (typeof d.title === 'string') parts.push(`“${d.title}”`)
  if (typeof d.reason === 'string' && d.reason) parts.push(`Alasan: ${d.reason}`)

  if (typeof d.from === 'string' && typeof d.to === 'string') {
    parts.push(`${d.from} → ${d.to}`)
  } else if (typeof d.from === 'string') {
    parts.push(`sebelumnya: ${d.from}`)
  }

  if (typeof d.direction === 'string') parts.push(d.direction === 'up' ? 'ke atas' : 'ke bawah')
  if (typeof d.type === 'string') parts.push(`jenis: ${d.type}`)

  if (d.impact && typeof d.impact === 'object') {
    const impact = d.impact as Record<string, unknown>
    const items = Object.entries(IMPACT_LABEL)
      .filter(([key]) => typeof impact[key] === 'number')
      .map(([key, label]) => `${impact[key]} ${label}`)
    if (items.length > 0) parts.push(`Dampak: ${items.join(', ')}`)
  }
  if (typeof d.media_removed === 'number' && d.media_removed > 0) {
    parts.push(`${d.media_removed} media ikut terhapus`)
  }

  return parts.join(' · ')
}

const ENTRY_SELECT = 'title, slug, subsections(slug, regions(slug))'

const entryHref = (e: EntryRef) =>
  `/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`
const editHref = (e: EntryRef) =>
  `/lorekeeper/edit/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`

// Mengubah (jenis target, id) menjadi nama dan tautan, dengan satu query per jenis
async function resolveTargets(supabase: Client, logs: LogRow[]) {
  const ids = (...types: string[]) => [
    ...new Set(
      logs
        .filter((l) => l.target_id && types.includes(l.target_type))
        .map((l) => l.target_id as string)
    ),
  ]

  const postIds = ids('note', 'comment')
  const blockIds = ids('content_block')
  const mediaIds = ids('block_media')
  const regionIds = ids('region')
  const subIds = ids('subsection')
  const entryIds = ids('entry')

  const [posts, blocks, media, regions, subs, entries] = await Promise.all([
    postIds.length > 0
      ? supabase
          .from('community_posts')
          .select(`id, lore_entries(${ENTRY_SELECT})`)
          .in('id', postIds)
      : Promise.resolve(null),
    blockIds.length > 0
      ? supabase
          .from('content_blocks')
          .select(`id, lore_entries(${ENTRY_SELECT})`)
          .in('id', blockIds)
      : Promise.resolve(null),
    mediaIds.length > 0
      ? supabase
          .from('block_media')
          .select(`id, content_blocks(lore_entries(${ENTRY_SELECT}))`)
          .in('id', mediaIds)
      : Promise.resolve(null),
    regionIds.length > 0
      ? supabase.from('regions').select('id, name, slug').in('id', regionIds)
      : Promise.resolve(null),
    subIds.length > 0
      ? supabase.from('subsections').select('id, name, slug, regions(slug)').in('id', subIds)
      : Promise.resolve(null),
    entryIds.length > 0
      ? supabase.from('lore_entries').select(`id, ${ENTRY_SELECT}`).in('id', entryIds)
      : Promise.resolve(null),
  ])

  const map = new Map<string, Target>()

  for (const p of (posts?.data ?? []) as unknown as { id: string; lore_entries: EntryRef }[]) {
    map.set(p.id, {
      label: `Entry “${p.lore_entries.title}”`,
      href: entryHref(p.lore_entries),
    })
  }
  for (const b of (blocks?.data ?? []) as unknown as { id: string; lore_entries: EntryRef }[]) {
    map.set(b.id, {
      label: `Blok di “${b.lore_entries.title}”`,
      href: editHref(b.lore_entries),
    })
  }
  for (const m of (media?.data ?? []) as unknown as {
    id: string
    content_blocks: { lore_entries: EntryRef }
  }[]) {
    const e = m.content_blocks.lore_entries
    map.set(m.id, { label: `Media di “${e.title}”`, href: editHref(e) })
  }
  for (const r of (regions?.data ?? []) as { id: string; name: string; slug: string }[]) {
    map.set(r.id, { label: r.name, href: `/lore/${r.slug}` })
  }
  for (const s of (subs?.data ?? []) as unknown as {
    id: string
    name: string
    slug: string
    regions: { slug: string }
  }[]) {
    map.set(s.id, { label: s.name, href: `/lore/${s.regions.slug}/${s.slug}` })
  }
  for (const e of (entries?.data ?? []) as unknown as (EntryRef & { id: string })[]) {
    map.set(e.id, { label: e.title, href: entryHref(e) })
  }

  return map
}

function pageHref(p: { aksi: string; pelaku: string; sebelum?: string }) {
  const q = new URLSearchParams()
  if (p.aksi) q.set('aksi', p.aksi)
  if (p.pelaku) q.set('pelaku', p.pelaku)
  if (p.sebelum) q.set('sebelum', p.sebelum)
  const s = q.toString()
  return `/lorekeeper/riwayat${s ? `?${s}` : ''}`
}

const selectClass = 'mt-1 rounded border border-gray-400 bg-transparent px-3 py-1.5 text-sm'

async function RiwayatContent({ searchParams }: { searchParams: SearchParams }) {
  await requireLorekeeper()
  const sp = await searchParams

  // Semua parameter divalidasi; nilai yang tidak sah diabaikan begitu saja
  const group = GROUPS.find((g) => g.key === first(sp.aksi))
  const actorRaw = first(sp.pelaku)
  const actor = UUID.test(actorRaw) ? actorRaw : ''
  const beforeRaw = first(sp.sebelum)
  const before = TIMESTAMP.test(beforeRaw) ? beforeRaw : ''

  const supabase = await createClient()

  let query = supabase
    .from('audit_log')
    .select(
      'id, actor_id, action, target_type, target_id, details, created_at, profiles(id, username)'
    )
    .order('created_at', { ascending: false })
    .limit(PAGE + 1)

  if (group) query = query.like('action', `${group.prefix}%`)
  if (actor) query = query.eq('actor_id', actor)
  if (before) query = query.lt('created_at', before)

  const [{ data, error }, { data: keeperRows }] = await Promise.all([
    query,
    supabase.from('profiles').select('id, username').eq('role', 'lorekeeper').order('username'),
  ])

  if (error) return <p className="mt-6">Gagal memuat riwayat.</p>

  const all = (data ?? []) as unknown as LogRow[]
  const rows = all.slice(0, PAGE)
  const hasMore = all.length > PAGE
  const targets = await resolveTargets(supabase, rows)
  const keepers = (keeperRows ?? []) as { id: string; username: string }[]

  const current = { aksi: group?.key ?? '', pelaku: actor }

  return (
    <>
      <form action="/lorekeeper/riwayat" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block text-xs">
          Jenis aksi
          <select name="aksi" defaultValue={current.aksi} className={`${selectClass} block`}>
            <option value="">Semua</option>
            {GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          Pelaku
          <select name="pelaku" defaultValue={current.pelaku} className={`${selectClass} block`}>
            <option value="">Semua lorekeeper</option>
            {keepers.map((k) => (
              <option key={k.id} value={k.id}>
                {k.username}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white">
          Terapkan
        </button>
        <Link href="/lorekeeper/riwayat" className="text-sm underline">
          Reset
        </Link>
      </form>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm opacity-70">Belum ada aktivitas yang cocok.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((l) => {
            const target = l.target_id ? targets.get(l.target_id) : undefined
            const fallbackName =
              typeof l.details.name === 'string'
                ? l.details.name
                : typeof l.details.title === 'string'
                  ? l.details.title
                  : null
            const detail = detailText(l.details)

            return (
              <li key={l.id} className="rounded border border-gray-400 p-3">
                <p className="text-xs opacity-60">{formatWIB(l.created_at, true)}</p>

                <p className="mt-1 text-sm">
                  {l.profiles ? (
                    <Link href={`/profile/${l.profiles.id}`} className="font-semibold hover:underline">
                      {l.profiles.username}
                    </Link>
                  ) : (
                    <span className="font-semibold">(akun dihapus)</span>
                  )}{' '}
                  {labelFor(l.action)}
                  {target ? (
                    <>
                      {': '}
                      {target.href ? (
                        <Link href={target.href} className="underline">
                          {target.label}
                        </Link>
                      ) : (
                        target.label
                      )}
                    </>
                  ) : (
                    l.target_id && (
                      <span className="opacity-70">
                        {': '}
                        {fallbackName ? `“${fallbackName}” ` : ''}(sudah dihapus)
                      </span>
                    )
                  )}
                </p>

                {detail && <p className="mt-1 text-xs opacity-70">{detail}</p>}
              </li>
            )
          })}
        </ul>
      )}

      {hasMore && (
        <p className="mt-6">
          <Link
            href={pageHref({ ...current, sebelum: rows[rows.length - 1].created_at })}
            className="rounded border border-gray-400 px-4 py-2 text-sm"
          >
            Lebih lama →
          </Link>
        </p>
      )}
    </>
  )
}

export default function RiwayatPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <p className="mb-4 text-sm">
        <Link href="/lorekeeper" className="underline">← Panel lorekeeper</Link>
      </p>
      <h1 className="text-2xl font-bold">Riwayat aktivitas</h1>
      <p className="mt-1 text-sm opacity-70">
        Catatan aksi moderasi dan pengelolaan konten oleh lorekeeper. Waktu dalam WIB.
      </p>

      <Suspense fallback={<p className="mt-6">Memuat...</p>}>
        <RiwayatContent searchParams={searchParams} />
      </Suspense>
    </main>
  )
}