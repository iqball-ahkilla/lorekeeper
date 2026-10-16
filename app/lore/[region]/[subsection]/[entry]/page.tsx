import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'

import CommentSection from '@/components/CommentSection'
import ApprovedNote from '@/components/ApprovedNote'
import BlockMedia, { type Media } from '@/components/BlockMedia'
import RichText from '@/components/RichText'

type Params = Promise<{ region: string; subsection: string; entry: string }>

type EntryData = {
  id: string
  title: string
  content_blocks: { id: string; body: string; sort_order: number; block_media: Media[] }[]
  subsections: { name: string; regions: { name: string } }
}

async function EntryContent({ params }: { params: Params }) {
  const { region, subsection, entry: entrySlug } = await params

  const { data } = await supabase
    .from('lore_entries')
    .select(
      'id, title, content_blocks(id, body, sort_order, block_media(id, media_type, media_url, caption, sort_order)), subsections!inner(name, regions!inner(name))'
    )
    .eq('slug', entrySlug)
    .eq('subsections.slug', subsection)
    .eq('subsections.regions.slug', region)
    .order('sort_order', { referencedTable: 'content_blocks' })
    .maybeSingle()

  if (!data) notFound()
    const entry = data as unknown as EntryData

    const { data: noteRows } = await supabase
    .from('community_posts')
    .select('id, content_block_id, body, edited_at, profiles!author_id(id, username)')
    .eq('lore_entry_id', entry.id)
    .eq('type', 'note')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })

  type ApprovedRow = {
    id: string
    content_block_id: string
    body: string
    edited_at: string | null
    profiles: { id: string, username: string }
  }

  const notesByBlock = new Map<string, ApprovedRow[]>()
  for (const n of (noteRows ?? []) as unknown as ApprovedRow[]) {
    const list = notesByBlock.get(n.content_block_id) ?? []
    list.push(n)
    notesByBlock.set(n.content_block_id, list)
  }

  return (
    <>
      <p className="text-sm">
        <Link href="/" className="underline">Semua region</Link>
        {' / '}
        <Link href={`/lore/${region}`} className="underline">{entry.subsections.regions.name}</Link>
        {' / '}
        <Link href={`/lore/${region}/${subsection}`} className="underline">{entry.subsections.name}</Link>
      </p>

      <h1 className="mt-4 text-2xl font-bold">{entry.title}</h1>

      <div className="mt-6 space-y-6">
        {entry.content_blocks.map((block) => (
          <section key={block.id}>
            
            <BlockMedia items={block.block_media} />

            <p className="whitespace-pre-line leading-relaxed">
              <RichText text={block.body} />
            </p>
            {(notesByBlock.get(block.id) ?? []).map((n) => (
              <ApprovedNote
                key={n.id}
                body={n.body}
                author={n.profiles.username}
                authorId={n.profiles.id}
                edited={n.edited_at !== null}
              />
            ))}
          </section>
        ))}
      </div>

      <section className="mt-12 border-t border-gray-400 pt-6">
        <Suspense fallback={<p>Memuat komentar...</p>}>
          <CommentSection
            entryId={entry.id}
            blocks={entry.content_blocks.map((b) => ({
              id: b.id,
              preview: b.body.slice(0, 60),
            }))}
          />
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