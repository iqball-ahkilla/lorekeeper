import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, type CurrentUser } from '@/lib/auth'
import CommentForm from '@/components/CommentForm'
import NoteForm from '@/components/NoteForm'
import RichText from '@/components/RichText'
import RelativeTime from '@/components/RelativeTime'
import ActionForm from '@/components/ActionForm'
import Attachments, { type Attachment } from '@/components/Attachments'
import { toggleVote } from '@/app/actions/votes'
import NoteEditForm from '@/components/NoteEditForm'
import { editComment, deleteComment, withdrawNote } from '@/app/actions/posts'

type Post = {
  id: string
  parent_id: string | null
  type: 'comment' | 'note'
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | null
  content_block_id: string | null
  author_id: string
  body: string
  evidence_text: string | null
  created_at: string
  edited_at: string | null
  edited_by: string | null
  deleted_at: string | null
  profiles: { id: string; username: string; role: string }
  note_votes: { user_id: string }[]
  note_attachments: Attachment[]
}

type Props = {
  entryId: string
  blocks: { id: string; preview: string }[]
}

const fieldClass =
  'w-full rounded border border-gray-400 bg-transparent px-3 py-2 text-sm'

// "diedit" kalau penulisnya sendiri yang mengubah, selain itu lorekeeper
function editedLabel(post: Post) {
  if (!post.edited_at || post.deleted_at) return null
  return post.edited_by && post.edited_by === post.author_id
    ? 'diedit'
    : 'disunting lorekeeper'
}

function Author({ post, blockNumber }: { post: Post; blockNumber?: number }) {
  const edited = editedLabel(post)

  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <Link
        href={`/profile/${post.profiles.id}`}
        className="font-semibold hover:underline"
      >
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
      <RelativeTime iso={post.created_at} className="opacity-50" />
      {edited && <span className="text-xs opacity-50">· {edited}</span>}
    </p>
  )
}

function PostBody({ post }: { post: Post }) {
  return (
    <p className="mt-1 whitespace-pre-line">
      {post.type === 'note' && post.status === 'approved' ? (
        <RichText text={post.body} />
      ) : (
        post.body
      )}
    </p>
  )
}

function VoteControl({ post, userId }: { post: Post; userId: string | null }) {
  const count = post.note_votes.length
  const voted = userId !== null && post.note_votes.some((v) => v.user_id === userId)

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
        ▲ {count}
        {voted ? ' · didukung' : ''}
      </button>
    </form>
  )
}

// Edit dan hapus komentar: penulis (edit + hapus), lorekeeper (hapus komentar orang lain)
function CommentControls({ post, user }: { post: Post; user: CurrentUser | null }) {
  if (!user || post.type !== 'comment' || post.deleted_at) return null

  const isAuthor = post.author_id === user.id
  const isModerator = user.role === 'lorekeeper'
  if (!isAuthor && !isModerator) return null

  return (
    <div className="mt-2 flex flex-wrap gap-4 text-sm">
      {isAuthor && (
        <details>
          <summary className="cursor-pointer underline">Edit</summary>
          <ActionForm action={editComment} submitLabel="Simpan" className="mt-2 space-y-2">
            <input type="hidden" name="postId" value={post.id} />
            <textarea
              name="body"
              required
              maxLength={2000}
              rows={3}
              defaultValue={post.body}
              className={fieldClass}
            />
          </ActionForm>
        </details>
      )}

      <details>
        <summary className="cursor-pointer text-red-500 underline">
          {isAuthor ? 'Hapus' : 'Hapus (moderator)'}
        </summary>
        <ActionForm
          action={deleteComment}
          submitLabel="Ya, hapus komentar"
          buttonClassName="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          className="mt-2 space-y-2"
        >
          <input type="hidden" name="postId" value={post.id} />
          <p className="text-xs text-red-500">
            Isi komentar akan dihapus permanen. Balasan di bawahnya tetap ada.
          </p>
        </ActionForm>
      </details>
    </div>
  )
}

   // Edit dan tarik note: hanya penulisnya, dan hanya sebelum approved/rejected
function NoteControls({ post, user }: { post: Post; user: CurrentUser | null }) {
    if (!user || post.type !== 'note' || post.deleted_at) return null
    if (post.author_id !== user.id) return null
    if (post.status !== 'submitted' && post.status !== 'under_review') return null

    return (
      <div className="mt-2 flex flex-wrap gap-4 text-sm">
        <details>
         <summary className="cursor-pointer underline">Edit catatan</summary>
         <div className="mt-2 rounded border border-gray-400 p-3">
           <p className="mb-2 text-xs opacity-70">
             Mengedit mengembalikan catatan ke antrian review dan mereset dukungan (vote).
            </p>
           <NoteEditForm
              key={`${post.id}-${post.edited_at ?? 'awal'}`}
              postId={post.id}
              userId={user.id}
              initialBody={post.body}
              initialEvidence={post.evidence_text ?? ''}
              existing={post.note_attachments.map((a) => ({
               id: a.id,
               file_name: a.file_name,
              file_type: a.file_type,
             }))}
           />
         </div>
        </details>

        <details>
        <summary className="cursor-pointer text-red-500 underline">Tarik catatan</summary>
        <ActionForm
          action={withdrawNote}
          submitLabel="Ya, tarik catatan"
          buttonClassName="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          className="mt-2 space-y-2"
         >
        <input type="hidden" name="postId" value={post.id} />
        <p className="text-xs text-red-500">
          Isi, bukti, lampiran, dan dukungan catatan ini akan dihapus. Balasan di
          bawahnya tetap ada.
        </p>
        </ActionForm>
       </details>
    </div>
  )
}

export default async function CommentSection({ entryId, blocks }: Props) {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('community_posts')
    .select(
      'id, parent_id, type, status, content_block_id, author_id, body, evidence_text, created_at, edited_at, edited_by, deleted_at, profiles!author_id(id, username, role), note_votes(user_id), note_attachments(id, file_path, file_name, file_type)'
    )
    .eq('lore_entry_id', entryId)
    .or('status.is.null,status.neq.rejected')
    .order('created_at', { ascending: true })

  if (error) return <p>Gagal memuat komentar.</p>

  const posts = (data ?? []) as unknown as Post[]
  const repliesOf = (id: string) =>
    posts.filter((p) => p.parent_id === id && p.deleted_at === null)
  const blockNumber = new Map(blocks.map((b, i) => [b.id, i + 1]))

  // Post utama yang sudah dihapus hanya ditampilkan kalau masih punya balasan
  const topLevel = posts.filter(
    (p) => p.parent_id === null && (p.deleted_at === null || repliesOf(p.id).length > 0)
  )

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
              <NoteForm entryId={entryId} userId={user.id} blocks={blocks} />
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
          const deleted = post.deleted_at !== null

          return (
            <article key={post.id}>
              {deleted ? (
                <p className="text-sm italic opacity-60">{post.body}</p>
              ) : (
                <>
                  <Author
                    post={post}
                    blockNumber={
                      post.content_block_id
                        ? blockNumber.get(post.content_block_id)
                        : undefined
                    }
                  />
                  <PostBody post={post} />

                  {post.type === 'note' && post.evidence_text && (
                    <p className="mt-2 border-l-2 border-gray-400 pl-3 text-sm opacity-80">
                      <span className="font-medium">Bukti:</span> {post.evidence_text}
                    </p>
                  )}
                  {post.type === 'note' && <Attachments items={post.note_attachments} />}

                  {post.type === 'note' && (
                    <div className="mt-2">
                      <VoteControl post={post} userId={user?.id ?? null} />
                    </div>
                  )}
                  <NoteControls post={post} user={user} />

                  <CommentControls post={post} user={user} />
                </>
              )}

              {replies.length > 0 && (
                <div className="mt-3 space-y-4 border-l border-gray-400 pl-4">
                  {replies.map((reply) => (
                    <div key={reply.id}>
                      <Author post={reply} />
                      <PostBody post={reply} />
                      <CommentControls post={reply} user={user} />
                    </div>
                  ))}
                </div>
              )}

              {user && !deleted && (
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