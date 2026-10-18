import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'
import CommentSection from '@/components/CommentSection'
import ApprovedNote from '@/components/ApprovedNote'
import BlockMedia, { type Media } from '@/components/BlockMedia'
import RichText from '@/components/RichText'
import EditContentLink from '@/components/EditContentLink'
import TableOfContents from '@/components/TableOfContents'

type Params = Promise<{ region: string; subsection: string; entry: string }>

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
  subsections: { name: string; status: ContentStatus; regions: { name: string; status: ContentStatus } }
}

type ApprovedRow = {
  id: string
  content_block_id: string
  body: string
  edited_at: string | null
  profiles: { id: string; username: string }
}

async function EntryContent({ params }: { params: Params }) {
  const { region, subsection, entry: entrySlug } = await params

  const supabase = await createClient()

  const { data } = await supabase
    .from('lore_entries')
    .select(
      'id, title, status, content_blocks(id, body, sort_order, block_type, heading_level, block_media(id, media_type, media_url, caption, sort_order)), subsections!inner(name, status, regions!inner(name, status))'
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

  // Note hanya boleh menempel ke paragraf dan kutipan, bukan heading
  const noteTargets = entry.content_blocks
    .filter((b) => b.block_type !== 'heading')
    .map((b) => ({
      id: b.id,
      preview: (b.block_type === 'quote' ? 'Kutipan: ' : '') + b.body.slice(0, 60),
    }))

  return (
    <>
      <p className="text-sm">
        <Link href="/" className="underline">Beranda</Link>
        {' / '}
        <Link href={`/lore/${region}`} className="underline">
          {entry.subsections.regions.name}
        </Link>
        {' / '}
        <Link href={`/lore/${region}/${subsection}`} className="underline">
          {entry.subsections.name}
        </Link>
      </p>

      <div className="mt-2 min-h-5">
        <Suspense fallback={null}>
          <EditContentLink href={`/lorekeeper/edit/${region}/${subsection}/${entrySlug}`} />
        </Suspense>
      </div>

      {hidden && (
        <p className="mt-3 rounded border border-yellow-600/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700">
          Pratinjau: halaman ini tidak terlihat oleh publik (entry: {entry.status},
          sub-section: {entry.subsections.status}, induk: {entry.subsections.regions.status}).
        </p>
      )}
      <h1 className="mt-4 flex items-center gap-3 text-2xl font-bold">
        {entry.title}
        <StatusBadge status={entry.status} hidePublished />
      </h1>

      {/* <h1 className="mt-4 text-2xl font-bold">{entry.title}</h1> */}

      <TableOfContents headings={headings} />

      <div className="mt-6 space-y-6">
        {entry.content_blocks.map((block) => {
          const notes = notesByBlock.get(block.id) ?? []

          if (block.block_type === 'heading') {
            const Tag = block.heading_level === 3 ? 'h3' : 'h2'
            return (
              <div key={block.id}>
                <BlockMedia items={block.block_media} />
                <Tag
                  id={`blok-${block.id}`}
                  className={
                    block.heading_level === 3
                      ? 'scroll-mt-4 pt-2 text-lg font-semibold'
                      : 'scroll-mt-4 pt-4 text-xl font-bold'
                  }
                >
                  {block.body}
                </Tag>
              </div>
            )
          }

          return (
            <section key={block.id}>
              <BlockMedia items={block.block_media} />

              {block.block_type === 'quote' ? (
                <blockquote className="whitespace-pre-line border-l-4 border-gray-400 pl-4 italic leading-relaxed opacity-90">
                  <RichText text={block.body} />
                </blockquote>
              ) : (
                <p className="whitespace-pre-line leading-relaxed">
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
      </div>

      <section className="mt-12 border-t border-gray-400 pt-6">
        <Suspense fallback={<p>Memuat komentar...</p>}>
          <CommentSection entryId={entry.id} blocks={noteTargets} />
        </Suspense>
      </section>
    </>
  )
}

export default function EntryPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <Suspense fallback={<p>Memuat...</p>}>
        <EntryContent params={params} />
      </Suspense>
    </main>
  )
}