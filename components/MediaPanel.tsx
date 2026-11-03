import ActionForm from '@/components/ActionForm'
import BlockMedia, { type Media } from '@/components/BlockMedia'
import MediaAddForm from '@/components/MediaAddForm'
import { deleteMedia, moveMedia, updateMedia } from '@/app/actions/media'

const btnClass =
  'rounded-md border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg'

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
    <div className="space-y-3 rounded-md border border-line bg-deep/40 p-3">
      <p className="eyebrow">Media ({sorted.length})</p>

      {sorted.map((m) => (
        <div key={m.id} className="space-y-2 rounded-md border border-line p-3">
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
              <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-xs text-rose transition-colors hover:bg-surface-2">
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
              className="field min-w-0 flex-1 py-1.5"
            />
          </ActionForm>
        </div>
      ))}

      <details>
        <summary className="cursor-pointer text-xs font-medium text-gold hover:underline">+ Tambah media</summary>
        <MediaAddForm entryId={entryId} blockId={blockId} />
      </details>
    </div>
  )
}