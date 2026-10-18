import ActionForm from '@/components/ActionForm'
import BlockMedia, { type Media } from '@/components/BlockMedia'
import MediaAddForm from '@/components/MediaAddForm'
import { deleteMedia, moveMedia, updateMedia } from '@/app/actions/media'

const btnClass = 'rounded border border-gray-400 px-2 py-1 text-xs'

export default function MediaPanel({
  entryId,
  blockId,
  items,
}: {
  entryId: string
  blockId: string
  items: Media[]
}) {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-3 rounded border border-gray-400 p-3">
      <p className="text-xs font-semibold">Media ({sorted.length})</p>

      {sorted.map((m) => (
        <div key={m.id} className="space-y-2 rounded border border-gray-400 p-3">
          <BlockMedia items={[m]} />

          <div className="flex flex-wrap items-center gap-2">
            <form action={moveMedia}>
              <input type="hidden" name="mediaId" value={m.id} />
              <input type="hidden" name="direction" value="up" />
              <button type="submit" className={btnClass} aria-label="Geser ke atas">
                ▲
              </button>
            </form>
            <form action={moveMedia}>
              <input type="hidden" name="mediaId" value={m.id} />
              <input type="hidden" name="direction" value="down" />
              <button type="submit" className={btnClass} aria-label="Geser ke bawah">
                ▼
              </button>
            </form>
            <form action={deleteMedia}>
              <input type="hidden" name="mediaId" value={m.id} />
              <button type="submit" className={`${btnClass} text-red-500`}>
                Hapus media
              </button>
            </form>
          </div>

          <ActionForm
            action={updateMedia}
            submitLabel="Simpan caption"
            className="flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="mediaId" value={m.id} />
            <input
              name="caption"
              defaultValue={m.caption ?? ''}
              maxLength={200}
              placeholder="Caption (opsional)"
              className="min-w-0 flex-1 rounded border border-gray-400 bg-transparent px-3 py-1.5 text-sm"
            />
          </ActionForm>
        </div>
      ))}

      <details>
        <summary className="cursor-pointer text-xs underline">+ Tambah media</summary>
        <MediaAddForm entryId={entryId} blockId={blockId} />
      </details>
    </div>
  )
}