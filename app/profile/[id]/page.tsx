import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'

import RichText from '@/components/RichText'
import Breadcrumb from '@/components/Breadcrumb'
import Avatar from '@/components/Avatar'
import { excerpt } from '@/lib/text'

import { formatDateWIB } from '@/lib/time'
import RelativeTime from '@/components/RelativeTime'

type Params = Promise<{ id: string }>

type ProfileNote = {
  id: string
  body: string
  created_at: string
  content_blocks: { body: string } | null
  lore_entries: {
    title: string
    slug: string
    subsections: { slug: string; regions: { slug: string } }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function ProfileContent({ params }: { params: Params }) {
  const { id } = await params
  if (!UUID.test(id)) notFound() // mencegah query dengan ID yang bukan UUID

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!profile) notFound()

  const { data } = await supabase
    .from('community_posts')
    .select(
      'id, body, created_at, content_blocks(body), lore_entries(title, slug, subsections(slug, regions(slug)))'
    )
    .eq('author_id', id)
    .eq('type', 'note')
    .eq('status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const notes = (data ?? []) as unknown as ProfileNote[]

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Beranda', href: '/' },
          { label: 'Leaderboard', href: '/leaderboard' },
          { label: profile.username },
        ]}
      />

      <header className="card mt-6 flex items-center gap-5 p-6">
        <Avatar name={profile.username} size="lg" />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-serif text-3xl font-semibold text-fg">
            <span className="truncate">{profile.username}</span>
            {profile.role === 'lorekeeper' && (
              <span className="rounded bg-gold/15 px-2 py-0.5 font-sans text-xs font-semibold uppercase tracking-wider text-gold">
                lorekeeper
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Bergabung {formatDateWIB(profile.created_at)} ·{' '}
            <span className="text-gold">{notes.length}</span> catatan disetujui
          </p>
        </div>
      </header>

      <h2 className="eyebrow mb-4 mt-10">Catatan yang disetujui</h2>
      {notes.length === 0 ? (
        <p className="card p-6 text-sm text-muted">Belum ada catatan yang disetujui.</p>
      ) : (
        <div className="space-y-4">
          {notes.map((n) => {
            const e = n.lore_entries
            const href = `/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`
            return (
              <article key={n.id} className="card space-y-3 p-5">
                <Link
                  href={href}
                  className="font-serif text-lg font-semibold text-fg hover:text-gold"
                >
                  {e.title}
                </Link>
                {n.content_blocks && (
                  <p className="border-l-2 border-line pl-3 text-sm text-faint">
                    {excerpt(n.content_blocks.body, 200)}
                  </p>
                )}
                <p className="border-l-2 border-gold-dim pl-3 italic leading-relaxed text-gold">
                  <RichText text={n.body} />
                </p>
                <p className="text-xs text-faint">
                  <RelativeTime iso={n.created_at} />
                </p>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

export default function ProfilePage({ params }: { params: Params }) {
  return (
    <main className="page max-w-3xl flex-1 py-8 sm:py-10">
      <Suspense fallback={<div className="card h-48 animate-pulse" />}>
        <ProfileContent params={params} />
      </Suspense>
    </main>
  )
}
