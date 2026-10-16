import { Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type SearchParams = Promise<{ q?: string | string[] }>

type RegionHit = { name: string; slug: string }
type SubsectionHit = {
  name: string
  alt_name: string | null
  slug: string
  regions: { name: string; slug: string }
}
type EntryHit = {
  title: string
  slug: string
  subsections: { name: string; slug: string; regions: { name: string; slug: string } }
}

// Buang karakter yang punya arti khusus di sintaks filter PostgREST,
// supaya input pengguna tidak bisa menyisipkan filter lain
function clean(q: string) {
  return q.replace(/[%,()*"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50)
}

function SearchForm({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/search" className="mb-6 flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Cari judul lore atau nama sub-section..."
        className="w-full rounded border border-gray-400 bg-transparent px-3 py-2"
      />
      <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
        Cari
      </button>
    </form>
  )
}

async function SearchContent({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).q
  const q = clean(Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? ''))

  if (q.length < 2) {
    return (
      <>
        <SearchForm defaultValue={q} />
        <p className="text-sm opacity-70">Ketik minimal 2 karakter.</p>
      </>
    )
  }

  const pattern = `%${q}%`

  const [regionsRes, subsectionsRes, entriesRes] = await Promise.all([
    supabase.from('regions').select('name, slug').ilike('name', pattern).limit(10),
    supabase
      .from('subsections')
      .select('name, alt_name, slug, regions(name, slug)')
      .or(`name.ilike."${pattern}",alt_name.ilike."${pattern}"`)
      .limit(20),
    supabase
      .from('lore_entries')
      .select('title, slug, subsections(name, slug, regions(name, slug))')
      .ilike('title', pattern)
      .limit(20),
  ])

  if (regionsRes.error || subsectionsRes.error || entriesRes.error) {
    return (
      <>
        <SearchForm defaultValue={q} />
        <p>Pencarian gagal. Coba lagi.</p>
      </>
    )
  }

  const regions = (regionsRes.data ?? []) as RegionHit[]
  const subsections = (subsectionsRes.data ?? []) as unknown as SubsectionHit[]
  const entries = (entriesRes.data ?? []) as unknown as EntryHit[]
  const total = regions.length + subsections.length + entries.length

  return (
    <>
      <SearchForm defaultValue={q} />

      {total === 0 ? (
        <p className="text-sm opacity-70">Tidak ada hasil untuk “{q}”.</p>
      ) : (
        <div className="space-y-6">
          {regions.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase opacity-60">Region</h2>
              <ul className="space-y-2">
                {regions.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/lore/${r.slug}`} className="font-medium underline">
                      {r.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {subsections.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase opacity-60">Sub-section</h2>
              <ul className="space-y-2">
                {subsections.map((s) => (
                  <li key={`${s.regions.slug}/${s.slug}`}>
                    <Link
                      href={`/lore/${s.regions.slug}/${s.slug}`}
                      className="font-medium underline"
                    >
                      {s.name}
                    </Link>
                    {s.alt_name && <span className="ml-2 text-sm opacity-50">{s.alt_name}</span>}
                    <p className="text-xs opacity-60">{s.regions.name}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entries.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase opacity-60">Lore</h2>
              <ul className="space-y-2">
                {entries.map((e) => (
                  <li key={`${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`}>
                    <Link
                      href={`/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`}
                      className="font-medium underline"
                    >
                      {e.title}
                    </Link>
                    <p className="text-xs opacity-60">
                      {e.subsections.regions.name} / {e.subsections.name}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  )
}

export default function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="mb-4 text-2xl font-bold">Cari</h1>
      <Suspense fallback={<SearchForm />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </main>
  )
}