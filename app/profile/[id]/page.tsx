import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'

import RichText from '@/components/RichText'

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

// function formatDate(iso: string) {
//   return new Date(iso).toLocaleDateString('id-ID', {
//     day: 'numeric',
//     month: 'short',
//     year: 'numeric',
//   })
// }

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
    .order('created_at', { ascending: false })

  const notes = (data ?? []) as unknown as ProfileNote[]

  return (
    <>
      <h1 className="flex items-center gap-3 text-2xl font-bold">
        {profile.username}
        {profile.role === 'lorekeeper' && (
          <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-sm font-normal text-yellow-600">
            lorekeeper
          </span>
        )}
      </h1>
      <p className="mt-1 text-sm opacity-70">
        Bergabung {formatDateWIB(profile.created_at)} · {notes.length} catatan disetujui
      </p>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Catatan yang disetujui</h2>
      {notes.length === 0 ? (
        <p className="text-sm opacity-70">Belum ada catatan yang disetujui.</p>
      ) : (
        <div className="space-y-4">
          {notes.map((n) => {
            const e = n.lore_entries
            const href = `/lore/${e.subsections.regions.slug}/${e.subsections.slug}/${e.slug}`
            return (
              <article key={n.id} className="space-y-2 rounded border border-gray-400 p-4">
                <Link href={href} className="text-sm font-semibold underline">
                  {e.title}
                </Link>
                {n.content_blocks && (
                  <p className="border-l-2 border-gray-400 pl-3 text-sm opacity-70">
                    {n.content_blocks.body.slice(0, 200)}
                  </p>
                )}
                <p className="italic text-yellow-600">
                  <RichText text={n.body} />
                </p>
                <p className="text-xs opacity-50"><RelativeTime iso={n.created_at} /></p>
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
    <main className="mx-auto w-full max-w-2xl p-8">
      <Suspense fallback={<p>Memuat...</p>}>
        <ProfileContent params={params} />
      </Suspense>
    </main>
  )
}