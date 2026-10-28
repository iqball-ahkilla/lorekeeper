import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'
import CommentSection from '@/components/CommentSection'
import ApprovedNote from '@/components/ApprovedNote'
import BlockMedia, { type Media } from '@/components/BlockMedia'
import RichText from '@/components/RichText'
import EditContentLink from '@/components/EditContentLink'
import TableOfContents from '@/components/TableOfContents'
import Breadcrumb from '@/components/Breadcrumb'
import { ClockIcon } from '@/components/Icons'
import { readMinutes } from '@/lib/text'

type Params = Promise<{ region: string; subsection: string; entry: string }>
type SearchParams = Promise<{ tampil?: string | string[] }>

type Block = {
  id: string
  body: string
  sort_order: number
  block_type: 'heading' | 'paragraph' | 'quote'
  heading_level: 2 | 3 | null
  block_media: Media[]
}

type EntryData = {
  id: string
  title: string
  status: ContentStatus
  content_blocks: Block[]
  subsections: {
    name: string
    alt_name: string | null
    status: ContentStatus
    regions: { name: string; status: ContentStatus }
  }
}

type ApprovedRow = {
  id: string
  content_block_id: string
  body: string
  edited_at: string | null
  profiles: { id: string; username: string }
}

async function EntryContent({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { region, subsection, entry: entrySlug } = await params
  const rawFilter = (await searchParams).tampil
  const tampil = Array.isArray(rawFilter) ? rawFilter[0] : rawFilter
  const filter = tampil === 'catatan' || tampil === 'komentar' ? tampil : undefined

  const supabase = await createClient()

  const { data } = await supabase
    .from('lore_entries')
    .select(
      'id, title, status, content_blocks(id, body, sort_order, block_type, heading_level, block_media(id, media_type, media_url, caption, sort_order)), subsections!inner(name, alt_name, status, regions!inner(name, status))'
    )
    .eq('slug', entrySlug)
    .eq('subsections.slug', subsection)
    .eq('subsections.regions.slug', region)
    .order('sort_order', { referencedTable: 'content_blocks' })
    .maybeSingle()

  if (!data) notFound()
  const entry = data as unknown as EntryData

  const hidden =
    entry.status !== 'published' ||
    entry.subsections.status !== 'published' ||
    entry.subsections.regions.status !== 'published'

  const { data: noteRows } = await supabase
    .from('community_posts')
    .select('id, content_block_id, body, edited_at, profiles!author_id(id, username)')
    .eq('lore_entry_id', entry.id)
    .eq('type', 'note')
    .eq('status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  const notesByBlock = new Map<string, ApprovedRow[]>()
  for (const n of (noteRows ?? []) as unknown as ApprovedRow[]) {
    const list = notesByBlock.get(n.content_block_id) ?? []
    list.push(n)
    notesByBlock.set(n.content_block_id, list)
  }

  const headings = entry.content_blocks
    .filter((b) => b.block_type === 'heading' && b.heading_level)
    .map((b) => ({ id: b.id, text: b.body, level: b.heading_level as 2 | 3 }))

  // Nomor urut "§ 1.", "§ 2." hanya untuk heading level 2 (sama dengan daftar isi)
  const sectionNumber = new Map<string, number>()
  headings.filter((h) => h.level === 2).forEach((h, i) => sectionNumber.set(h.id, i + 1))

  // Note hanya boleh menempel ke paragraf dan kutipan, bukan heading
  const noteTargets = entry.content_blocks
    .filter((b) => b.block_type !== 'heading')
    .map((b) => ({
      id: b.id,
      preview: (b.block_type === 'quote' ? 'Kutipan: ' : '') + b.body.slice(0, 60),
    }))

  const minutes = readMinutes(
    entry.content_blocks.filter((b) => b.block_type !== 'heading').map((b) => b.body)
  )
  const hasToc = headings.length >= 2

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Beranda', href: '/' },
          { label: entry.subsections.regions.name, href: `/lore/${region}` },
          {
            label: entry.subsections.name,
            href: `/lore/${region}/${subsection}`,
            sub: entry.subsections.alt_name ?? undefined,
          },
          { label: entry.title },
        ]}
      />

      <div className="mt-2 min-h-5">
        <Suspense fallback={null}>
          <EditContentLink href={`/lorekeeper/edit/${region}/${subsection}/${entrySlug}`} />
        </Suspense>
      </div>

      {hidden && (
        <p className="mt-3 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
          Pratinjau: halaman ini tidak terlihat oleh publik (entri: {entry.status},
          sub-bagian: {entry.subsections.status}, induk: {entry.subsections.regions.status}).
        </p>
      )}

      <header className="mt-6 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip border-gold/30 text-gold">Lore resmi</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-faint">
            <ClockIcon className="h-3.5 w-3.5" />
            {minutes} menit baca
          </span>
          <StatusBadge status={entry.status} hidePublished />
        </div>
        <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-parch sm:text-5xl">
          {entry.title}
        </h1>
      </header>

      <div
        className={`mt-8 grid gap-8 ${hasToc ? 'lg:grid-cols-[minmax(0,1fr)_18rem]' : ''}`}
      >
        {/* Daftar isi: di atas artikel pada layar kecil, di sisi kanan (menempel) pada layar lebar */}
        {hasToc && (
          <aside className="lg:order-2 lg:sticky lg:top-24 lg:self-start">
            <TableOfContents headings={headings} />
          </aside>
        )}

        <article className="min-w-0 max-w-3xl space-y-6 lg:order-1">
          {entry.content_blocks.map((block) => {
            const notes = notesByBlock.get(block.id) ?? []

            if (block.block_type === 'heading') {
              const Tag = block.heading_level === 3 ? 'h3' : 'h2'
              const num = sectionNumber.get(block.id)
              return (
                <div key={block.id}>
                  <BlockMedia items={block.block_media} />
                  <Tag
                    id={`blok-${block.id}`}
                    className={
                      block.heading_level === 3
                        ? 'scroll-mt-24 pt-2 font-serif text-xl font-semibold text-fg'
                        : 'scroll-mt-24 border-t border-line pt-6 font-serif text-2xl font-semibold text-fg'
                    }
                  >
                    {num && <span className="mr-2 text-gold-dim">§ {num}.</span>}
                    {block.body}
                  </Tag>
                </div>
              )
            }

            return (
              <section key={block.id}>
                <BlockMedia items={block.block_media} />

                {block.block_type === 'quote' ? (
                  <blockquote className="whitespace-pre-line rounded-r-md border-l-2 border-gold-dim bg-deep/60 px-5 py-4 italic leading-relaxed text-muted">
                    <RichText text={block.body} />
                  </blockquote>
                ) : (
                  <p className="whitespace-pre-line text-[17px] leading-8 text-fg">
                    <RichText text={block.body} />
                  </p>
                )}

                {notes.map((n) => (
                  <ApprovedNote
                    key={n.id}
                    body={n.body}
                    author={n.profiles.username}
                    authorId={n.profiles.id}
                    edited={n.edited_at !== null}
                  />
                ))}
              </section>
            )
          })}
        </article>
      </div>

      <section id="komunitas" className="mt-14 scroll-mt-24 border-t border-line pt-8">
        <Suspense fallback={<div className="card h-40 animate-pulse" />}>
          <CommentSection
            entryId={entry.id}
            blocks={noteTargets}
            basePath={`/lore/${region}/${subsection}/${entrySlug}`}
            filter={filter}
          />
        </Suspense>
      </section>
    </>
  )
}

export default function EntryPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  return (
    <main className="page flex-1 py-8 sm:py-10">
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <EntryContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
