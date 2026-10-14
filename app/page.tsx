import { Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Region = { name: string; slug: string; description: string | null }

async function RegionList() {
  const { data, error } = await supabase
    .from('regions')
    .select('name, slug, description')
    .order('sort_order')

  if (error) return <p>Error: {error.message}</p>

  const regions = (data ?? []) as Region[]
  if (regions.length === 0) return <p>Belum ada region.</p>

  return (
    <ul className="space-y-4">
      {regions.map((r) => (
        <li key={r.slug}>
          <Link href={`/lore/${r.slug}`} className="text-lg font-semibold underline">
            {r.name}
          </Link>
          {r.description && <p className="text-sm opacity-70">{r.description}</p>}
        </li>
      ))}
    </ul>
  )
}

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Lore Wiki</h1>
      <Suspense fallback={<p>Memuat...</p>}>
        <RegionList />
      </Suspense>
    </main>
  )
}