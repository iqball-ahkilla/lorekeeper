import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import CommentForm from '@/components/CommentForm'
import NoteForm from '@/components/NoteForm'

import { toggleVote } from '@/app/actions/votes'
import Attachments, { type Attachment } from '@/components/Attachments'

type Post = {
  id: string
  parent_id: string | null
  type: 'comment' | 'note'
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | null
  content_block_id: string | null
  body: string
  evidence_text: string | null
  created_at: string
  profiles: { id: string, username: string; role: string }
  author_id: string
  note_votes: { user_id: string }[]
  note_attachments: Attachment[]
  edited_at: string | null
}

type Props = {
  entryId: string
  blocks: { id: string; preview: string }[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function Author({ post, blockNumber }: { post: Post; blockNumber?: number }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <Link href={`/profile/${post.profiles.id}`} className="font-semibold hover:underline">
       {post.profiles.username}
      </Link>      
      {post.profiles.role === 'lorekeeper' && (
        <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600">
          lorekeeper
        </span>
      )}
      {post.type === 'note' && (
        <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-500">
          Lore Entry{blockNumber ? ` · paragraf ${blockNumber}` : ''}
        </span>
      )}
      {post.status === 'under_review' && (
        <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs text-orange-500">
          Under review by lorekeeper
        </span>
      )}
      {post.status === 'approved' && (
        <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-600">
          Disetujui
        </span>
      )}
      <span className="opacity-50">{formatDate(post.created_at)}</span>
    </p>
  )
}

function VoteControl({ post, userId }: { post: Post; userId: string | null }) {
  const count = post.note_votes.length
  const voted = userId !== null && post.note_votes.some((v) => v.user_id === userId)

  // Belum login atau note milik sendiri: hanya menampilkan jumlah
  if (!userId || post.author_id === userId) {
    return <span className="text-sm opacity-70">▲ {count}</span>
  }

  return (
    <form action={toggleVote} className="inline">
      <input type="hidden" name="postId" value={post.id} />
      <button
        type="submit"
        className={`text-sm ${voted ? 'font-semibold text-blue-500' : 'opacity-70'}`}
      >
        ▲ {count}{voted ? ' · didukung' : ''}
      </button>
    </form>
  )
}

export default async function CommentSection({ entryId, blocks }: Props) {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('community_posts')
    .select(
      'id, parent_id, type, status, content_block_id, body, evidence_text, author_id, note_votes(user_id), created_at, edited_at, profiles!author_id(id, username, role), note_attachments(id, file_path, file_name, file_type)'
    )
    .eq('lore_entry_id', entryId)
    .or('status.is.null,status.neq.rejected')
    .order('created_at', { ascending: true })

  if (error) return <p>Gagal memuat komentar.</p>

  const posts = (data ?? []) as unknown as Post[]
  const topLevel = posts.filter((p) => p.parent_id === null)
  const repliesOf = (id: string) => posts.filter((p) => p.parent_id === id)
  const blockNumber = new Map(blocks.map((b, i) => [b.id, i + 1]))

  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">Komunitas</h2>

      {user ? (
        <div className="space-y-3">
          <CommentForm entryId={entryId} placeholder="Tulis komentar..." />

          <details className="rounded border border-gray-400 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Ajukan Lore Entry (catatan dengan bukti)
            </summary>
            <div className="mt-3">
              <NoteForm entryId={entryId} blocks={blocks} userId={user.id} />
            </div>
          </details>
        </div>
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
              <Author
                post={post}
                blockNumber={
                  post.content_block_id ? blockNumber.get(post.content_block_id) : undefined
                }
              />
              <p className="mt-1 whitespace-pre-line">{post.body}</p>

              {post.type === 'note' && post.edited_at && (
                <p className="text-xs opacity-50">disunting lorekeeper</p>
               )}

              {post.type === 'note' && post.evidence_text && (
                <p className="mt-2 border-l-2 border-gray-400 pl-3 text-sm opacity-80">
                  <span className="font-medium">Bukti:</span> {post.evidence_text}
                </p>
              )}

              <Attachments items={post.note_attachments} />

              {post.type === 'note' && (
                <div className="mt-2">
                    <VoteControl post={post} userId={user?.id ?? null} />
                </div>
              )}

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