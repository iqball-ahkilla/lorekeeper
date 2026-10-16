import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireLorekeeper } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import ParagraphForm from '@/components/ParagraphForm'
import type { LinkTarget } from '@/components/LinkTextarea'

type Params = Promise<{ region: string; subsection: string; entry: string }>

type EditData = {
  title: string
  content_blocks: { id: string; body: string; sort_order: number }[]
}

async function EditContent({ params }: { params: Params }) {
  await requireLorekeeper()
  const { region, subsection, entry: entrySlug } = await params

  const supabase = await createClient()

  const { data } = await supabase
    .from('lore_entries')
    .select(
      'title, content_blocks(id, body, sort_order), subsections!inner(slug, regions!inner(slug))'
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

  return (
    <>
      <p className="text-sm">
        <Link href={`/lore/${region}/${subsection}/${entrySlug}`} className="underline">
          ← Kembali ke halaman
        </Link>
      </p>

      <h1 className="mt-4 text-2xl font-bold">Edit: {entry.title}</h1>
      <p className="mt-1 text-sm opacity-70">
        Ketik <code>[[</code> untuk menyisipkan tautan ke halaman lore lain. Pilih dengan
        panah dan Enter.
      </p>

      <div className="mt-6 space-y-8">
        {entry.content_blocks.map((b, i) => (
          <ParagraphForm
            key={b.id}
            blockId={b.id}
            label={`Paragraf ${i + 1}`}
            initial={b.body}
            targets={targets}
          />
        ))}
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