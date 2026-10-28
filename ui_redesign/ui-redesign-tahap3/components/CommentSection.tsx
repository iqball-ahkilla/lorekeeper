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
  basePath: string // alamat halaman entri, untuk tautan tab filter
  filter?: 'catatan' | 'komentar'
}

const fieldClass = 'field'

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
        className="font-semibold text-fg hover:text-gold"
      >
        {post.profiles.username}
      </Link>
      {post.profiles.role === 'lorekeeper' && (
        <span className="rounded bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
          lorekeeper
        </span>
      )}
      {post.type === 'note' && (
        <span className="rounded bg-sky/15 px-2 py-0.5 text-xs font-semibold text-sky">
          Catatan komunitas{blockNumber ? ` · paragraf ${blockNumber}` : ''}
        </span>
      )}
      {post.status === 'under_review' && (
        <span className="rounded bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
          Sedang direview lorekeeper
        </span>
      )}
      {post.status === 'approved' && (
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
          Disetujui
        </span>
      )}
      <RelativeTime iso={post.created_at} className="text-faint" />
      {edited && <span className="text-xs text-faint">· {edited}</span>}
    </p>
  )
}

function PostBody({ post }: { post: Post }) {
  return (
    <p className="mt-2 whitespace-pre-line leading-relaxed text-fg/90">
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
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm text-muted">
        ▲ {count}
      </span>
    )
  }

  return (
    <form action={toggleVote} className="inline">
      <input type="hidden" name="postId" value={post.id} />
      <button
        type="submit"
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors ${
          voted
            ? 'border-gold/50 bg-gold/10 font-semibold text-gold'
            : 'border-line text-muted hover:border-gold/40 hover:text-fg'
        }`}
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
          <summary className="cursor-pointer text-muted hover:text-fg">Edit</summary>
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
        <summary className="cursor-pointer text-rose hover:underline">
          {isAuthor ? 'Hapus' : 'Hapus (moderator)'}
        </summary>
        <ActionForm
          action={deleteComment}
          submitLabel="Ya, hapus komentar"
          buttonClassName="btn-danger disabled:opacity-50"
          className="mt-2 space-y-2"
        >
          <input type="hidden" name="postId" value={post.id} />
          <p className="text-xs text-rose">
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
         <summary className="cursor-pointer text-muted hover:text-fg">Edit catatan</summary>
         <div className="mt-2 rounded-md border border-line bg-deep/40 p-3">
           <p className="mb-2 text-xs text-faint">
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
        <summary className="cursor-pointer text-rose hover:underline">Tarik catatan</summary>
        <ActionForm
          action={withdrawNote}
          submitLabel="Ya, tarik catatan"
          buttonClassName="btn-danger disabled:opacity-50"
          className="mt-2 space-y-2"
         >
        <input type="hidden" name="postId" value={post.id} />
        <p className="text-xs text-rose">
          Isi, bukti, lampiran, dan dukungan catatan ini akan dihapus. Balasan di
          bawahnya tetap ada.
        </p>
        </ActionForm>
       </details>
    </div>
  )
}

export default async function CommentSection({ entryId, blocks, basePath, filter }: Props) {
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

  const noteCount = posts.filter((p) => p.type === 'note' && p.deleted_at === null).length
  const commentCount = posts.filter((p) => p.type === 'comment' && p.deleted_at === null).length

  // Post utama yang sudah dihapus hanya ditampilkan kalau masih punya balasan
  const topLevel = posts.filter(
    (p) =>
      p.parent_id === null &&
      (p.deleted_at === null || repliesOf(p.id).length > 0) &&
      (!filter || p.type === (filter === 'catatan' ? 'note' : 'comment'))
  )

  const tabs = [
    { key: undefined, label: 'Semua', count: noteCount + commentCount },
    { key: 'catatan', label: 'Catatan', count: noteCount },
    { key: 'komentar', label: 'Komentar', count: commentCount },
  ] as const

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Diskusi komunitas</p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-fg">Komunitas</h2>
        </div>

        <nav
          className="inline-flex self-start rounded-lg border border-line bg-deep/60 p-1 sm:self-auto"
          aria-label="Saring diskusi"
        >
          {tabs.map((t) => {
            const on = t.key === filter
            return (
              <Link
                key={t.label}
                href={t.key ? `${basePath}?tampil=${t.key}#komunitas` : `${basePath}#komunitas`}
                scroll={false}
                aria-current={on ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  on ? 'bg-surface-2 text-gold' : 'text-muted hover:text-fg'
                }`}
              >
                {t.label} ({t.count})
              </Link>
            )
          })}
        </nav>
      </div>

      <details className="card mt-5 p-4 text-sm">
        <summary className="cursor-pointer font-medium text-fg">
          Bagaimana catatan komunitas diproses?
        </summary>
        <ol className="mt-3 grid gap-2 text-muted sm:grid-cols-4">
          <li className="rounded-md border border-line p-3">
            <span className="eyebrow">1 · Diajukan</span>
            <span className="mt-1 block">Hanya terlihat oleh penulisnya.</span>
          </li>
          <li className="rounded-md border border-line p-3">
            <span className="eyebrow">2 · Direview</span>
            <span className="mt-1 block">Lorekeeper mulai memeriksa bukti.</span>
          </li>
          <li className="rounded-md border border-line p-3">
            <span className="eyebrow">3 · Disetujui</span>
            <span className="mt-1 block">Tampil kuning di bawah paragraf terkait.</span>
          </li>
          <li className="rounded-md border border-line p-3">
            <span className="eyebrow text-rose">4 · Ditolak</span>
            <span className="mt-1 block">Alasan hanya terlihat oleh penulis.</span>
          </li>
        </ol>
      </details>

      <div className="mt-5">
        {user ? (
          <div className="space-y-3">
            <div className="card p-4">
              <CommentForm entryId={entryId} placeholder="Tulis komentar..." />
            </div>

            <details className="card p-4">
              <summary className="cursor-pointer text-sm font-medium text-gold">
                Ajukan catatan komunitas (dengan bukti)
              </summary>
              <div className="mt-4">
                <NoteForm entryId={entryId} userId={user.id} blocks={blocks} />
              </div>
            </details>
          </div>
        ) : (
          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              Kamu membaca sebagai tamu. Masuk untuk berkomentar atau mengajukan catatan
              komunitas.
            </p>
            <div className="flex shrink-0 gap-2">
              <Link href="/login" className="btn-ghost py-1.5">
                Masuk
              </Link>
              <Link href="/signup" className="btn-gold py-1.5">
                Daftar
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {topLevel.length === 0 && (
          <p className="card p-6 text-sm text-muted">
            {filter === 'catatan'
              ? 'Belum ada catatan komunitas.'
              : filter === 'komentar'
                ? 'Belum ada komentar.'
                : 'Belum ada komentar.'}
          </p>
        )}

        {topLevel.map((post) => {
          const replies = repliesOf(post.id)
          const deleted = post.deleted_at !== null

          return (
            <article key={post.id} className="card p-5">
              {deleted ? (
                <p className="text-sm italic text-faint">{post.body}</p>
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
                    <div className="mt-3 rounded-md border border-line bg-deep p-3 text-sm">
                      <p className="eyebrow">Bukti</p>
                      <p className="mt-1 leading-relaxed text-muted">{post.evidence_text}</p>
                    </div>
                  )}
                  {post.type === 'note' && <Attachments items={post.note_attachments} />}

                  {post.type === 'note' && (
                    <div className="mt-3">
                      <VoteControl post={post} userId={user?.id ?? null} />
                    </div>
                  )}
                  <NoteControls post={post} user={user} />

                  <CommentControls post={post} user={user} />
                </>
              )}

              {replies.length > 0 && (
                <div className="mt-4 space-y-4 border-l border-line pl-4">
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
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium text-gold">Balas</summary>
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
