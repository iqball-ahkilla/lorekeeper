import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'

type Params = Promise<{ region: string; subsection: string }>

type SubsectionData = {
  name: string
  alt_name: string | null
  status: ContentStatus
  regions: { name: string; slug: string }
  lore_entries: { title: string; slug: string; status: ContentStatus }[]
}

async function SubsectionContent({ params }: { params: Params }) {
  const { region: regionSlug, subsection: subsectionSlug } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('subsections')
    .select('name, alt_name, status, regions!inner(name, slug), lore_entries(title, slug, status)')
    .eq('slug', subsectionSlug)
    .eq('regions.slug', regionSlug)
    .order('title', { referencedTable: 'lore_entries' })
    .maybeSingle()

  if (!data) notFound()
  const sub = data as unknown as SubsectionData

  return (
    <>
      <p className="text-sm">
        <Link href="/" className="underline">Beranda</Link>
        {' / '}
        <Link href={`/lore/${regionSlug}`} className="underline">{sub.regions.name}</Link>
      </p>

      <h1 className="mt-4 flex flex-wrap items-center gap-3 text-2xl font-bold">
        {sub.name}
        {sub.alt_name && (
          <span className="text-base font-normal opacity-50">{sub.alt_name}</span>
        )}
        <StatusBadge status={sub.status} hidePublished />
      </h1>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Daftar lore</h2>
      {sub.lore_entries.length === 0 ? (
        <p>Belum ada entry.</p>
      ) : (
        <ul className="space-y-2">
          {sub.lore_entries.map((e) => (
            <li key={e.slug} className="flex items-center gap-2">
              <Link
                href={`/lore/${regionSlug}/${subsectionSlug}/${e.slug}`}
                className="underline"
              >
                {e.title}
              </Link>
              <StatusBadge status={e.status} hidePublished />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function SubsectionPage({ params }: { params: Params }) {
  return (
    <main className="p-8">
      <Suspense fallback={<p>Memuat...</p>}>
        <SubsectionContent params={params} />
      </Suspense>
    </main>
  )
}