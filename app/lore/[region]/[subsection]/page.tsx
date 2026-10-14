import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Params = Promise<{ region: string; subsection: string }>

type SubsectionData = {
  name: string
  alt_name: string | null
  regions: { name: string; slug: string }
  lore_entries: { title: string; slug: string }[]
}

async function SubsectionContent({ params }: { params: Params }) {
  const { region: regionSlug, subsection: subsectionSlug } = await params

  const { data } = await supabase
    .from('subsections')
    .select('name, alt_name, regions!inner(name, slug), lore_entries(title, slug)')
    .eq('slug', subsectionSlug)
    .eq('regions.slug', regionSlug)
    .order('title', { referencedTable: 'lore_entries' })
    .maybeSingle()

  if (!data) notFound()
    const sub = data as unknown as SubsectionData

  return (
    <>
      <p className="text-sm">
        <Link href="/" className="underline">Semua region</Link>
        {' / '}
        <Link href={`/lore/${regionSlug}`} className="underline">{sub.regions.name}</Link>
      </p>

      <h1 className="mt-4 text-2xl font-bold">
        {sub.name}
        {sub.alt_name && <span className="ml-3 text-base font-normal opacity-50">{sub.alt_name}</span>}
      </h1>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Daftar lore</h2>
      {sub.lore_entries.length === 0 ? (
        <p>Belum ada entry.</p>
      ) : (
        <ul className="space-y-2">
          {sub.lore_entries.map((e) => (
            <li key={e.slug}>
              <Link href={`/lore/${regionSlug}/${subsectionSlug}/${e.slug}`} className="underline">
                {e.title}
              </Link>
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