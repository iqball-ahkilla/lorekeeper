import { createClient } from '@/lib/supabase/server'
import { changeStatus, moveItem, updateItem } from '@/app/actions/structure'
import ActionForm from '@/components/ActionForm'
import DeleteItemForm from '@/components/DeleteItemForm'
import type { ContentStatus } from '@/components/StatusBadge'

type ItemType = 'region' | 'subsection' | 'entry'

export type ControlItem = {
  id: string
  name: string
  slug: string
  status: ContentStatus
  firstPublishedAt: string | null
  description?: string | null
  altName?: string | null
  kind?: 'region' | 'topic'
}

const inputClass =
  'mt-1 w-full rounded border border-gray-400 bg-transparent px-3 py-1.5 text-sm'
const btnClass = 'rounded border border-gray-400 px-2 py-1 text-xs'

const IMPACT_LABELS: Record<string, string> = {
  subsections: 'sub-section',
  entries: 'entry',
  blocks: 'blok teks',
  posts: 'komentar dan catatan',
}

function formatImpact(d: Record<string, number> | null) {
  if (!d) return 'seluruh isinya'
  const parts = Object.entries(IMPACT_LABELS)
    .filter(([key]) => typeof d[key] === 'number')
    .map(([key, label]) => `${d[key]} ${label}`)
  return parts.length > 0 ? parts.join(', ') : 'seluruh isinya'
}

function StatusButton({
  type,
  id,
  op,
  label,
}: {
  type: ItemType
  id: string
  op: 'publish' | 'archive' | 'restore'
  label: string
}) {
  return (
    <form action={changeStatus}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button type="submit" className={btnClass}>{label}</button>
    </form>
  )
}

function MoveButton({
  type,
  id,
  direction,
}: {
  type: ItemType
  id: string
  direction: 'up' | 'down'
}) {
  return (
    <form action={moveItem}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        className={btnClass}
        aria-label={direction === 'up' ? 'Geser ke atas' : 'Geser ke bawah'}
      >
        {direction === 'up' ? '▲' : '▼'}
      </button>
    </form>
  )
}

export default async function ItemControls({
  type,
  item,
  canMove,
}: {
  type: ItemType
  item: ControlItem
  canMove: boolean
}) {
  let summary = ''
  if (item.status === 'archived') {
    const supabase = await createClient()
    const { data } = await supabase.rpc('delete_impact', { p_type: type, p_id: item.id })
    summary = formatImpact(data as Record<string, number> | null)
  }

  const slugLocked = item.firstPublishedAt !== null

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {item.status === 'draft' && (
          <StatusButton type={type} id={item.id} op="publish" label="Terbitkan" />
        )}
        {item.status !== 'archived' && (
          <StatusButton type={type} id={item.id} op="archive" label="Arsipkan" />
        )}
        {item.status === 'archived' && (
          <StatusButton type={type} id={item.id} op="restore" label="Pulihkan" />
        )}
        {canMove && (
          <>
            <MoveButton type={type} id={item.id} direction="up" />
            <MoveButton type={type} id={item.id} direction="down" />
          </>
        )}
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs underline">Edit</summary>
        <ActionForm
          action={updateItem}
          submitLabel="Simpan"
          className="mt-2 space-y-2 rounded border border-gray-400 p-3"
        >
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="id" value={item.id} />

          <label className="block text-xs">
            {type === 'entry' ? 'Judul' : 'Nama'}
            <input name="name" required defaultValue={item.name} className={inputClass} />
          </label>

          {type === 'subsection' && (
            <label className="block text-xs">
              Nama alternatif (opsional)
              <input name="alt_name" defaultValue={item.altName ?? ''} className={inputClass} />
            </label>
          )}

          {type === 'region' && (
            <>
              <label className="block text-xs">
                Jenis
                <select name="kind" defaultValue={item.kind ?? 'region'} className={inputClass}>
                  <option value="region">Wilayah</option>
                  <option value="topic">Topik</option>
                </select>
              </label>
              <label className="block text-xs">
                Deskripsi
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={item.description ?? ''}
                  className={inputClass}
                />
              </label>
            </>
          )}

          {slugLocked ? (
            <p className="text-xs opacity-70">
              Slug: <code>{item.slug}</code> (terkunci karena pernah diterbitkan)
            </p>
          ) : (
            <label className="block text-xs">
              Slug (masih bisa diubah karena belum pernah terbit)
              <input name="slug" defaultValue={item.slug} className={inputClass} />
            </label>
          )}
        </ActionForm>
      </details>

      {item.status === 'archived' && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-red-500 underline">
            Hapus permanen
          </summary>
          <DeleteItemForm type={type} id={item.id} name={item.name} summary={summary} />
        </details>
      )}
    </div>
  )
}