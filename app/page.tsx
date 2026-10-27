import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'

type Region = {
  name: string
  slug: string
  description: string | null
  kind: 'region' | 'topic'
  status: ContentStatus
}

function Group({ title, items }: { title: string; items: Region[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase opacity-60">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/lore/${r.slug}`}
              className="block rounded border border-gray-400 p-4 hover:border-blue-500"
            >
              <span className="flex items-center gap-2">
                <span className="text-lg font-semibold">{r.name}</span>
                <StatusBadge status={r.status} hidePublished />
              </span>
              {r.description && (
                <span className="mt-1 block text-sm opacity-70">{r.description}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

async function RegionList() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('regions')
    .select('name, slug, description, kind, status')
    .order('sort_order')

  if (error) return <p>Error: {error.message}</p>

  const all = (data ?? []) as Region[]
  if (all.length === 0) return <p>Belum ada konten.</p>

  const regions = all.filter((r) => r.kind === 'region')
  const topics = all.filter((r) => r.kind === 'topic')

  return (
    <div className="space-y-8">
      {regions.length > 0 && <Group title="Wilayah" items={regions} />}
      {topics.length > 0 && <Group title="Topik" items={topics} />}
    </div>
  )
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Lore Wiki</h1>

      <form action="/search" className="mb-8">
        <input
          type="search"
          name="q"
          placeholder="Cari lore..."
          className="w-full max-w-sm rounded border border-gray-400 bg-transparent px-3 py-2"
        />
      </form>

      <Suspense fallback={<p>Memuat...</p>}>
        <RegionList />
      </Suspense>
    </main>
  )
}