import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'
import Breadcrumb from '@/components/Breadcrumb'
import { ArrowRightIcon } from '@/components/Icons'

type Subsection = {
  name: string
  alt_name: string | null
  slug: string
  status: ContentStatus
  lore_entries: { status: ContentStatus }[]
}

type RegionData = {
  name: string
  description: string | null
  kind: 'region' | 'topic'
  status: ContentStatus
  subsections: Subsection[]
}

async function RegionContent({ params }: { params: Promise<{ region: string }> }) {
  const { region: regionSlug } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('regions')
    .select(
      'name, description, kind, status, subsections(name, alt_name, slug, status, sort_order, lore_entries(status))'
    )
    .eq('slug', regionSlug)
    .order('sort_order', { referencedTable: 'subsections' })
    .maybeSingle()

  if (!data) notFound()
  const region = data as unknown as RegionData

  return (
    <>
      <Breadcrumb items={[{ label: 'Beranda', href: '/' }, { label: region.name }]} />

      <header className="mt-6 max-w-2xl">
        <p className="eyebrow">{region.kind === 'region' ? 'Wilayah' : 'Topik'}</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 font-serif text-4xl font-semibold text-fg">
          {region.name}
          <StatusBadge status={region.status} hidePublished />
        </h1>
        {region.description && (
          <p className="mt-3 leading-relaxed text-muted">{region.description}</p>
        )}
      </header>

      <h2 className="eyebrow mb-4 mt-10">Sub-bagian</h2>
      {region.subsections.length === 0 ? (
        <p className="card p-6 text-sm text-muted">Belum ada sub-bagian.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {region.subsections.map((s) => {
            const count = s.lore_entries.filter((e) => e.status === 'published').length
            return (
              <li key={s.slug}>
                <Link
                  href={`/lore/${regionSlug}/${s.slug}`}
                  className="card group flex h-full flex-col p-5 transition-colors hover:border-gold/50 hover:bg-surface-2"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-serif text-xl font-semibold leading-snug text-fg">
                      {s.name}
                    </span>
                    <StatusBadge status={s.status} hidePublished />
                  </span>
                  {s.alt_name && (
                    <span className="mt-1 text-xs text-faint/80">{s.alt_name}</span>
                  )}
                  <span className="mt-auto flex items-center justify-between pt-5 text-xs text-faint">
                    <span>{count} entri</span>
                    <span className="inline-flex items-center gap-1 font-medium text-gold">
                      Buka
                      <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

export default function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  return (
    <main className="page flex-1 py-8 sm:py-10">
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <RegionContent params={params} />
      </Suspense>
    </main>
  )
}
