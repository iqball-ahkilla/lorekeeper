import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import CommentForm from '@/components/CommentForm'

type Post = {
  id: string
  parent_id: string | null
  body: string
  created_at: string
  profiles: { username: string; role: string }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function Author({ post }: { post: Post }) {
  return (
    <p className="text-sm">
      <span className="font-semibold">{post.profiles.username}</span>
      {post.profiles.role === 'lorekeeper' && (
        <span className="ml-2 rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600">
          lorekeeper
        </span>
      )}
      <span className="ml-2 opacity-50">{formatDate(post.created_at)}</span>
    </p>
  )
}

export default async function CommentSection({ entryId }: { entryId: string }) {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('community_posts')
    .select('id, parent_id, body, created_at, profiles!author_id(username, role)')
    .eq('lore_entry_id', entryId)
    .eq('type', 'comment')
    .order('created_at', { ascending: true })

  if (error) return <p>Gagal memuat komentar.</p>

  const posts = (data ?? []) as unknown as Post[]
  const topLevel = posts.filter((p) => p.parent_id === null)
  const repliesOf = (id: string) => posts.filter((p) => p.parent_id === id)

  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">Komunitas</h2>

      {user ? (
        <CommentForm entryId={entryId} placeholder="Tulis komentar..." />
      ) : (
        <p className="text-sm">
          <Link href="/login" className="underline">Masuk</Link> untuk ikut berkomentar.
        </p>
      )}

      <div className="mt-6 space-y-6">
        {topLevel.length === 0 && (
          <p className="text-sm opacity-70">Belum ada komentar.</p>
        )}

        {topLevel.map((post) => {
          const replies = repliesOf(post.id)
          return (
            <article key={post.id}>
              <Author post={post} />
              <p className="mt-1 whitespace-pre-line">{post.body}</p>

              {replies.length > 0 && (
                <div className="mt-3 space-y-4 border-l border-gray-400 pl-4">
                  {replies.map((reply) => (
                    <div key={reply.id}>
                      <Author post={reply} />
                      <p className="mt-1 whitespace-pre-line">{reply.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {user && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer underline">Balas</summary>
                  <div className="mt-2">
                    <CommentForm
                      entryId={entryId}
                      parentId={post.id}
                      placeholder="Tulis balasan..."
                    />
                  </div>
                </details>
              )}
            </article>
          )
        })}
      </div>
    </>
  )
}