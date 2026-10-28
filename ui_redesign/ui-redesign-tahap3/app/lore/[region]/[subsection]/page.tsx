import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'
import Breadcrumb from '@/components/Breadcrumb'
import { ArrowRightIcon, ClockIcon } from '@/components/Icons'
import { excerpt, readMinutes } from '@/lib/text'

type Params = Promise<{ region: string; subsection: string }>

type Block = { body: string; block_type: 'heading' | 'paragraph' | 'quote'; sort_order: number }

type SubsectionData = {
  name: string
  alt_name: string | null
  status: ContentStatus
  regions: { name: string; slug: string }
  lore_entries: {
    title: string
    slug: string
    status: ContentStatus
    content_blocks: Block[]
  }[]
}

async function SubsectionContent({ params }: { params: Params }) {
  const { region: regionSlug, subsection: subsectionSlug } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('subsections')
    .select(
      'name, alt_name, status, regions!inner(name, slug), lore_entries(title, slug, status, content_blocks(body, block_type, sort_order))'
    )
    .eq('slug', subsectionSlug)
    .eq('regions.slug', regionSlug)
    .order('title', { referencedTable: 'lore_entries' })
    .maybeSingle()

  if (!data) notFound()
  const sub = data as unknown as SubsectionData

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Beranda', href: '/' },
          { label: sub.regions.name, href: `/lore/${regionSlug}` },
          { label: sub.name, sub: sub.alt_name ?? undefined },
        ]}
      />

      <header className="mt-6 max-w-2xl">
        <p className="eyebrow">Sub-bagian</p>
        <h1 className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-serif text-4xl font-semibold text-fg">
          {sub.name}
          {sub.alt_name && (
            <span className="font-sans text-base font-normal text-faint/80">{sub.alt_name}</span>
          )}
          <StatusBadge status={sub.status} hidePublished />
        </h1>
      </header>

      <h2 className="eyebrow mb-4 mt-10">Daftar lore</h2>
      {sub.lore_entries.length === 0 ? (
        <p className="card p-6 text-sm text-muted">Belum ada entri.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {sub.lore_entries.map((e) => {
            const blocks = [...e.content_blocks].sort((a, b) => a.sort_order - b.sort_order)
            const intro = blocks.find((b) => b.block_type === 'paragraph')?.body
            const minutes = readMinutes(
              blocks.filter((b) => b.block_type !== 'heading').map((b) => b.body)
            )
            return (
              <li key={e.slug}>
                <Link
                  href={`/lore/${regionSlug}/${subsectionSlug}/${e.slug}`}
                  className="card group flex h-full flex-col p-5 transition-colors hover:border-gold/50 hover:bg-surface-2"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-serif text-xl font-semibold leading-snug text-fg">
                      {e.title}
                    </span>
                    <StatusBadge status={e.status} hidePublished />
                  </span>
                  {intro && (
                    <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                      {excerpt(intro, 200)}
                    </span>
                  )}
                  <span className="mt-auto flex items-center justify-between pt-5 text-xs text-faint">
                    <span className="inline-flex items-center gap-1.5">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {minutes} menit baca
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-gold">
                      Baca
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

export default function SubsectionPage({ params }: { params: Params }) {
  return (
    <main className="page flex-1 py-8 sm:py-10">
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <SubsectionContent params={params} />
      </Suspense>
    </main>
  )
}
