import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Subsection = { name: string; alt_name: string | null; slug: string }

async function RegionContent({ params }: { params: Promise<{ region: string }> }) {
  const { region: regionSlug } = await params

  const { data: region } = await supabase
    .from('regions')
    .select('name, description, subsections(name, alt_name, slug, sort_order)')
    .eq('slug', regionSlug)
    .order('sort_order', { referencedTable: 'subsections' })
    .maybeSingle()

  if (!region) notFound()

  const subsections = (region.subsections ?? []) as Subsection[]

  return (
    <>
      <h1 className="text-2xl font-bold">{region.name}</h1>
      {region.description && <p className="mt-2 opacity-70">{region.description}</p>}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Sub-section</h2>
      {subsections.length === 0 ? (
        <p>Belum ada sub-section.</p>
      ) : (
        <ul className="space-y-3">
          {subsections.map((s) => (
            <li key={s.slug}>
              <Link href={`/lore/${regionSlug}/${s.slug}`} className="font-medium underline">
                {s.name}
              </Link>
              {s.alt_name && <span className="ml-2 text-sm opacity-50">{s.alt_name}</span>}
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
      <Link href="/" className="text-sm underline">← Semua region</Link>
      <div className="mt-4">
        <Suspense fallback={<p>Memuat...</p>}>
          <RegionContent params={params} />
        </Suspense>
      </div>
    </main>
  )
}