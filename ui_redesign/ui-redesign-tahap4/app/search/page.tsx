import { Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SearchIcon } from '@/components/Icons'

const KIND_LABEL: Record<string, string> = { region: 'Wilayah', topic: 'Topik' }

type SearchParams = Promise<{ q?: string | string[] }>

type RegionHit = { name: string; slug: string; kind: string }
type SubsectionHit = {
  name: string
  alt_name: string | null
  slug: string
  regions: { name: string; slug: string; kind: string }
}
type EntryHit = {
  title: string
  slug: string
  subsections: { name: string; slug: string; regions: { name: string; slug: string; kind: string } }
}

// Buang karakter yang punya arti khusus di sintaks filter PostgREST,
// supaya input pengguna tidak bisa menyisipkan filter lain
function clean(q: string) {
  return q.replace(/[%,()*"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50)
}

function SearchForm({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/search" className="card mb-8 p-2">
      <div className="flex items-center gap-2">
        <SearchIcon className="ml-2 h-4 w-4 shrink-0 text-muted" />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Cari wilayah, sub-bagian, atau judul lore…"
          aria-label="Cari lore"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-fg placeholder:text-faint focus:outline-none"
        />
        <button type="submit" className="btn-gold shrink-0">
          Cari
        </button>
      </div>
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
        <p className="text-sm text-muted">Ketik minimal 2 karakter.</p>
      </>
    )
  }

  const pattern = `%${q}%`

  const [regionsRes, subsectionsRes, entriesRes] = await Promise.all([
    supabase.from('regions').select('name, slug, kind').ilike('name', pattern).limit(10),
    supabase
      .from('subsections')
      .select('name, alt_name, slug, regions(name, slug, kind)')
      .or(`name.ilike."${pattern}",alt_name.ilike."${pattern}"`)
      .limit(20),
    supabase
      .from('lore_entries')
      .select('title, slug, subsections(name, slug, regions(name, slug, kind))')
      .ilike('title', pattern)
      .limit(20),
  ])

  if (regionsRes.error || subsectionsRes.error || entriesRes.error) {
    return (
      <>
        <SearchForm defaultValue={q} />
        <p className="card p-6 text-sm text-rose">Pencarian gagal. Coba lagi.</p>
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
        <p className="card p-6 text-sm text-muted">Tidak ada hasil untuk “{q}”.</p>
      ) : (
        <div className="space-y-8">
          <p className="text-sm text-muted">
            {total} hasil untuk “<span className="text-fg">{q}</span>”
          </p>
          {regions.length > 0 && (
            <section>
              <h2 className="eyebrow mb-3">Wilayah &amp; topik</h2>
              <ul className="space-y-3">
                {regions.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/lore/${r.slug}`}
                      className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-gold/50 hover:bg-surface-2"
                    >
                      <span className="font-serif text-lg font-semibold text-fg">{r.name}</span>
                      <span className="chip">{KIND_LABEL[r.kind]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {subsections.length > 0 && (
            <section>
              <h2 className="eyebrow mb-3">Sub-bagian</h2>
              <ul className="space-y-3">
                {subsections.map((s) => (
                  <li key={`${s.regions.slug}/${s.slug}`}>
                    <Link
                      href={`/lore/${s.regions.slug}/${s.slug}`}
                      className="card block px-4 py-3 transition-colors hover:border-gold/50 hover:bg-surface-2"
                    >
                      <span className="font-serif text-lg font-semibold text-fg">{s.name}</span>
                      {s.alt_name && (
                        <span className="ml-2 text-xs text-faint/80">{s.alt_name}</span>
                      )}
                      <span className="mt-0.5 block text-xs text-faint">
                        {KIND_LABEL[s.regions.kind]} · {s.regions.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entries.length > 0 && (
            <section>
              <h2 className="eyebrow mb-3">Entri lore</h2>
              <ul className="space-y-3">
                {entries.map((e) => (
                  <li key={`${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`}>
                    <Link
                      href={`/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`}
                      className="card block px-4 py-3 transition-colors hover:border-gold/50 hover:bg-surface-2"
                    >
                      <span className="font-serif text-lg font-semibold text-fg">{e.title}</span>
                      <span className="mt-0.5 block text-xs text-faint">
                        {KIND_LABEL[e.subsections.regions.kind]} · {e.subsections.regions.name} /{' '}
                        {e.subsections.name}
                      </span>
                    </Link>
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
    <main className="page max-w-3xl flex-1 py-8 sm:py-10">
      <p className="eyebrow">Pencarian</p>
      <h1 className="mb-6 mt-1 font-serif text-4xl font-semibold text-fg">Cari Lore</h1>
      <Suspense fallback={<SearchForm />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </main>
  )
}