import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireLorekeeper } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ActionForm from '@/components/ActionForm'
import LinkTextarea, { type LinkTarget } from '@/components/LinkTextarea'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'
import { addBlock, deleteBlock, moveBlock, updateBlock } from '@/app/actions/blocks'

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

type Kind = 'paragraph' | 'quote' | 'heading2' | 'heading3'

const KIND_LABEL: Record<Kind, string> = {
  paragraph: 'Paragraf',
  quote: 'Kutipan',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
}

const fieldClass =
  'mt-1 w-full rounded border border-gray-400 bg-transparent px-3 py-2 text-sm'

function kindOf(b: BlockRow): Kind {
  if (b.block_type === 'heading') return b.heading_level === 3 ? 'heading3' : 'heading2'
  return b.block_type
}

function KindSelect({ defaultValue }: { defaultValue: Kind }) {
  return (
    <label className="block text-xs">
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
    <details className="rounded border border-dashed border-gray-400 p-3">
      <summary className="cursor-pointer text-xs font-semibold">{label}</summary>
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
        className="rounded border border-gray-400 px-2 py-1 text-xs"
        aria-label={direction === 'up' ? 'Geser ke atas' : 'Geser ke bawah'}
      >
        {direction === 'up' ? '▲' : '▼'}
      </button>
    </form>
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

  const blocks = entry.content_blocks

  return (
    <>
      <p className="flex flex-wrap gap-4 text-sm">
        <Link href={`/lore/${region}/${subsection}/${entrySlug}`} className="underline">
          ← Lihat halaman
        </Link>
        <Link href="/lorekeeper/konten" className="underline">
          Kelola struktur
        </Link>
      </p>

      <h1 className="mt-4 flex flex-wrap items-center gap-3 text-2xl font-bold">
        Edit isi: {entry.title}
        <StatusBadge status={entry.status} />
      </h1>
      <p className="mt-1 text-sm opacity-70">
        Ketik <code>[[</code> untuk menyisipkan tautan ke halaman lore lain. Perubahan pada
        entry yang sudah terbit langsung tampil ke publik.
      </p>

      <div className="mt-6 space-y-4">
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
            <article key={b.id} className="space-y-3 rounded border border-gray-400 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Blok {i + 1} · {KIND_LABEL[kindOf(b)]}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  {mediaCount > 0 && <span className="opacity-70">{mediaCount} media</span>}
                  {activeNotes > 0 && (
                    <span className="opacity-70">{activeNotes} catatan aktif</span>
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
                <summary className="cursor-pointer text-xs text-red-500 underline">
                  Hapus blok
                </summary>
                {activeNotes > 0 ? (
                  <p className="mt-2 text-xs text-red-500">
                    Blok ini punya {activeNotes} catatan aktif. Tolak atau tarik catatannya
                    dulu di Panel Lorekeeper.
                  </p>
                ) : (
                  <ActionForm
                    action={deleteBlock}
                    submitLabel="Ya, hapus blok"
                    buttonClassName="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    className="mt-2 space-y-2"
                  >
                    <input type="hidden" name="blockId" value={b.id} />
                    <p className="text-xs text-red-500">
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
    </>
  )
}

export default function EditPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <Suspense fallback={<p>Memuat...</p>}>
        <EditContent params={params} />
      </Suspense>
    </main>
  )
}