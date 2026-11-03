import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireLorekeeper } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ActionForm from '@/components/ActionForm'
import LinkTextarea, { type LinkTarget } from '@/components/LinkTextarea'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'
import { addBlock, deleteBlock, moveBlock, updateBlock } from '@/app/actions/blocks'
import { changeStatus } from '@/app/actions/structure'
import Breadcrumb from '@/components/Breadcrumb'

import MediaPanel from '@/components/MediaPanel'
import { type Media } from '@/components/BlockMedia'

type Params = Promise<{ region: string; subsection: string; entry: string }>

type BlockRow = {
  id: string
  body: string
  sort_order: number
  block_type: 'heading' | 'paragraph' | 'quote'
  heading_level: 2 | 3 | null
  block_media: Media[]
  community_posts: {
    id: string
    type: string
    status: string | null
    deleted_at: string | null
  }[]
}

type EditData = {
  id: string
  title: string
  status: ContentStatus
  content_blocks: BlockRow[]
}

type TreeRegion = {
  name: string
  slug: string
  kind: 'region' | 'topic'
  status: ContentStatus
  subsections: {
    name: string
    slug: string
    status: ContentStatus
    lore_entries: { title: string; slug: string; status: ContentStatus }[]
  }[]
}

type Kind = 'paragraph' | 'quote' | 'heading2' | 'heading3'

const KIND_LABEL: Record<Kind, string> = {
  paragraph: 'Paragraf',
  quote: 'Kutipan',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
}

const fieldClass = 'field mt-1'

function kindOf(b: BlockRow): Kind {
  if (b.block_type === 'heading') return b.heading_level === 3 ? 'heading3' : 'heading2'
  return b.block_type
}

function KindSelect({ defaultValue }: { defaultValue: Kind }) {
  return (
    <label className="block text-xs text-muted">
      Jenis blok
      <select name="kind" defaultValue={defaultValue} className={fieldClass}>
        <option value="paragraph">Paragraf</option>
        <option value="quote">Kutipan (teks asli dari game)</option>
        <option value="heading2">Heading 2 (sub-judul)</option>
        <option value="heading3">Heading 3 (anak sub-judul)</option>
      </select>
    </label>
  )
}

function AddBlockForm({
  entryId,
  position,
  afterBlockId,
  label,
  targets,
}: {
  entryId: string
  position: 'start' | 'after' | 'end'
  afterBlockId?: string
  label: string
  targets: LinkTarget[]
}) {
  return (
    <details className="rounded-lg border border-dashed border-line p-3 transition-colors hover:border-gold/40">
      <summary className="cursor-pointer text-xs font-semibold text-gold">{label}</summary>
      <ActionForm
        action={addBlock}
        submitLabel="Tambah blok"
        resetOnSuccess
        className="mt-3 space-y-2"
      >
        <input type="hidden" name="entryId" value={entryId} />
        <input type="hidden" name="position" value={position} />
        {afterBlockId && <input type="hidden" name="afterBlockId" value={afterBlockId} />}
        <KindSelect defaultValue="paragraph" />
        <LinkTextarea
          name="body"
          targets={targets}
          rows={4}
          maxLength={5000}
          required
          className={fieldClass}
        />
      </ActionForm>
    </details>
  )
}

function MoveButton({ blockId, direction }: { blockId: string; direction: 'up' | 'down' }) {
  return (
    <form action={moveBlock}>
      <input type="hidden" name="blockId" value={blockId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        className="rounded-md border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        aria-label={direction === 'up' ? 'Geser ke atas' : 'Geser ke bawah'}
      >
        {direction === 'up' ? '▲' : '▼'}
      </button>
    </form>
  )
}

function StructureTree({
  tree,
  currentRegion,
  currentSub,
  currentEntry,
}: {
  tree: TreeRegion[]
  currentRegion: string
  currentSub: string
  currentEntry: string
}) {
  return (
    <nav aria-label="Struktur konten" className="card p-3 text-sm">
      <p className="eyebrow px-1 pb-2">Struktur konten</p>
      <ul className="space-y-1">
        {tree.map((r) => (
          <li key={r.slug}>
            <details open={r.slug === currentRegion}>
              <summary className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-fg hover:bg-surface-2">
                <span className="truncate font-medium">{r.name}</span>
                <StatusBadge status={r.status} hidePublished />
              </summary>
              <ul className="ml-3 mt-1 space-y-1 border-l border-line pl-2">
                {r.subsections.map((sub) => (
                  <li key={sub.slug}>
                    <details open={r.slug === currentRegion && sub.slug === currentSub}>
                      <summary className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-muted hover:bg-surface-2 hover:text-fg">
                        <span className="truncate">{sub.name}</span>
                        <span className="ml-auto text-xs text-faint">
                          {sub.lore_entries.length}
                        </span>
                      </summary>
                      <ul className="ml-2 mt-1 space-y-0.5">
                        {sub.lore_entries.map((e) => {
                          const on =
                            r.slug === currentRegion &&
                            sub.slug === currentSub &&
                            e.slug === currentEntry
                          return (
                            <li key={e.slug}>
                              <Link
                                href={`/lorekeeper/edit/${r.slug}/${sub.slug}/${e.slug}`}
                                aria-current={on ? 'page' : undefined}
                                className={`flex items-center gap-2 rounded px-2 py-1 ${
                                  on
                                    ? 'border-l-2 border-gold bg-surface-2 text-gold'
                                    : 'text-muted hover:bg-surface-2 hover:text-fg'
                                }`}
                              >
                                <span className="truncate">{e.title}</span>
                                <StatusBadge status={e.status} hidePublished />
                              </Link>
                            </li>
                          )
                        })}
                        {sub.lore_entries.length === 0 && (
                          <li className="px-2 py-1 text-xs text-faint">Belum ada entri.</li>
                        )}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
      <Link href="/lorekeeper/konten" className="link-gold mt-3 px-1">
        Kelola struktur
      </Link>
    </nav>
  )
}

async function EditContent({ params }: { params: Params }) {
  await requireLorekeeper()
  const { region, subsection, entry: entrySlug } = await params

  const supabase = await createClient()

  const { data } = await supabase
    .from('lore_entries')
    .select(
      'id, title, status, content_blocks(id, body, sort_order, block_type, heading_level, block_media(id, media_type, media_url, caption, sort_order), community_posts(id, type, status, deleted_at)), subsections!inner(slug, regions!inner(slug))'
    )
    .eq('slug', entrySlug)
    .eq('subsections.slug', subsection)
    .eq('subsections.regions.slug', region)
    .order('sort_order', { referencedTable: 'content_blocks' })
    .maybeSingle()

  if (!data) notFound()
  const entry = data as unknown as EditData

  const { data: targetRows } = await supabase
    .from('link_targets')
    .select('path, label, kind, search_text')
  const targets = (targetRows ?? []) as LinkTarget[]

  const { data: treeRows } = await supabase
    .from('regions')
    .select(
      'name, slug, kind, status, sort_order, subsections(name, slug, status, sort_order, lore_entries(title, slug, status))'
    )
    .order('sort_order', { ascending: true })
    .order('sort_order', { ascending: true, referencedTable: 'subsections' })
  const tree = ((treeRows ?? []) as unknown as TreeRegion[]).map((r) => ({
    ...r,
    subsections: r.subsections.map((sub) => ({
      ...sub,
      lore_entries: [...sub.lore_entries].sort((a, b) => a.title.localeCompare(b.title)),
    })),
  }))

  const blocks = entry.content_blocks

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Beranda', href: '/' },
          { label: 'Kelola konten', href: '/lorekeeper/konten' },
          { label: entry.title },
        ]}
      />

      <header className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Editor entri</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-serif text-3xl font-semibold text-fg sm:text-4xl">
            {entry.title}
            <StatusBadge status={entry.status} />
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Ketik <code className="rounded bg-deep px-1 text-gold">[[</code> untuk menyisipkan
            tautan ke halaman lore lain. Perubahan pada entri yang sudah terbit langsung tampil
            ke publik.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/lore/${region}/${subsection}/${entrySlug}`} className="btn-ghost">
            Lihat halaman
          </Link>
          {entry.status === 'draft' && (
            <form action={changeStatus}>
              <input type="hidden" name="type" value="entry" />
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="op" value="publish" />
              <button type="submit" className="btn-gold">
                Terbitkan
              </button>
            </form>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
          <StructureTree
            tree={tree}
            currentRegion={region}
            currentSub={subsection}
            currentEntry={entrySlug}
          />
        </aside>

        <div className="min-w-0">
      <div className="space-y-4">
        {blocks.length > 0 && (
          <AddBlockForm
            entryId={entry.id}
            position="start"
            label="+ Tambah blok di awal"
            targets={targets}
          />
        )}

        {blocks.map((b, i) => {
          const mediaCount = b.block_media.length
          const activeNotes = b.community_posts.filter(
            (p) =>
              p.type === 'note' &&
              p.deleted_at === null &&
              ['submitted', 'under_review', 'approved'].includes(p.status ?? '')
          ).length

          return (
            <article key={b.id} className="card space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium text-fg">
                  <span className="font-serif text-lg text-gold-dim">{i + 1}</span>
                  <span className="chip border-gold/30 text-gold">{KIND_LABEL[kindOf(b)]}</span>
                </p>
                <div className="flex items-center gap-2 text-xs">
                  {mediaCount > 0 && <span className="text-faint">{mediaCount} media</span>}
                  {activeNotes > 0 && (
                    <span className="text-faint">{activeNotes} catatan aktif</span>
                  )}
                  <MoveButton blockId={b.id} direction="up" />
                  <MoveButton blockId={b.id} direction="down" />
                </div>
              </div>

              <ActionForm action={updateBlock} submitLabel="Simpan" className="space-y-2">
                <input type="hidden" name="blockId" value={b.id} />
                <KindSelect defaultValue={kindOf(b)} />
                <LinkTextarea
                  name="body"
                  defaultValue={b.body}
                  targets={targets}
                  rows={5}
                  maxLength={5000}
                  required
                  className={fieldClass}
                />
              </ActionForm>

              <MediaPanel entryId={entry.id} blockId={b.id} items={b.block_media} />

              <details>
                <summary className="cursor-pointer text-xs font-medium text-rose hover:underline">
                  Hapus blok
                </summary>
                {activeNotes > 0 ? (
                  <p className="mt-2 text-xs text-rose">
                    Blok ini punya {activeNotes} catatan aktif. Tolak atau tarik catatannya
                    dulu di Panel Lorekeeper.
                  </p>
                ) : (
                  <ActionForm
                    action={deleteBlock}
                    submitLabel="Ya, hapus blok"
                    buttonClassName="btn-danger disabled:opacity-50"
                    className="mt-2 space-y-2"
                  >
                    <input type="hidden" name="blockId" value={b.id} />
                    <p className="text-xs text-rose">
                      Blok ini
                      {mediaCount > 0
                        ? ` beserta ${mediaCount} media (file gambarnya ikut dihapus dari Storage)`
                        : ''}{' '}
                      akan dihapus permanen.
                    </p>
                  </ActionForm>
                )}
              </details>

              <AddBlockForm
                entryId={entry.id}
                position="after"
                afterBlockId={b.id}
                label="+ Tambah blok di bawah ini"
                targets={targets}
              />
            </article>
          )
        })}

        <AddBlockForm
          entryId={entry.id}
          position="end"
          label={blocks.length === 0 ? '+ Tambah blok pertama' : '+ Tambah blok di akhir'}
          targets={targets}
        />
      </div>
        </div>
      </div>
    </>
  )
}

export default function EditPage({ params }: { params: Params }) {
  return (
    <main className="page flex-1 py-8 sm:py-10">
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <EditContent params={params} />
      </Suspense>
    </main>
  )
}