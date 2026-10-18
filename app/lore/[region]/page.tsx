import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'

type Subsection = {
  name: string
  alt_name: string | null
  slug: string
  status: ContentStatus
}

type RegionData = {
  name: string
  description: string | null
  status: ContentStatus
  subsections: Subsection[]
}

async function RegionContent({ params }: { params: Promise<{ region: string }> }) {
  const { region: regionSlug } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('regions')
    .select('name, description, status, subsections(name, alt_name, slug, status, sort_order)')
    .eq('slug', regionSlug)
    .order('sort_order', { referencedTable: 'subsections' })
    .maybeSingle()

  if (!data) notFound()
  const region = data as unknown as RegionData

  return (
    <>
      <h1 className="flex items-center gap-3 text-2xl font-bold">
        {region.name}
        <StatusBadge status={region.status} hidePublished />
      </h1>
      {region.description && <p className="mt-2 opacity-70">{region.description}</p>}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Sub-section</h2>
      {region.subsections.length === 0 ? (
        <p>Belum ada sub-section.</p>
      ) : (
        <ul className="space-y-3">
          {region.subsections.map((s) => (
            <li key={s.slug} className="flex flex-wrap items-center gap-2">
              <Link href={`/lore/${regionSlug}/${s.slug}`} className="font-medium underline">
                {s.name}
              </Link>
              {s.alt_name && <span className="text-sm opacity-50">{s.alt_name}</span>}
              <StatusBadge status={s.status} hidePublished />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  return (
    <main className="p-8">
      <Link href="/" className="text-sm underline">← Beranda</Link>
      <div className="mt-4">
        <Suspense fallback={<p>Memuat...</p>}>
          <RegionContent params={params} />
        </Suspense>
      </div>
    </main>
  )
}