'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireLorekeeper } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { slugify } from '@/lib/slug'

export type ActionState = { ok: boolean; message: string } | null

type ItemType = 'region' | 'subsection' | 'entry'
type Status = 'draft' | 'published' | 'archived'

// Daftar putih: nama tabel tidak pernah diambil mentah dari form
const TABLE = {
  region: 'regions',
  subsection: 'subsections',
  entry: 'lore_entries',
} as const

const NAME_COLUMN = { region: 'name', subsection: 'name', entry: 'title' } as const

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (message: string): ActionState => ({ ok: false, message })

function parseType(v: FormDataEntryValue | null): ItemType | null {
  return v === 'region' || v === 'subsection' || v === 'entry' ? v : null
}

function resolveSlug(name: string, input: string): string | null {
  const candidate = input.trim() || slugify(name)
  return SLUG.test(candidate) ? candidate : null
}

function refresh() {
  revalidatePath('/', 'layout')
}

function createError(code: string | undefined): ActionState {
  return fail(
    code === '23505'
      ? 'Slug sudah dipakai. Ubah nama atau isi slug secara manual.'
      : 'Gagal menyimpan.'
  )
}

// ---------------------------------------------------------------- tambah

export async function createRegion(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()

  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const kind = formData.get('kind') === 'topic' ? 'topic' : 'region'

  if (name.length < 2 || name.length > 80) return fail('Nama harus 2-80 karakter.')
  const slug = resolveSlug(name, String(formData.get('slug') ?? ''))
  if (!slug) return fail('Slug tidak valid: pakai huruf kecil, angka, dan tanda hubung.')

  const supabase = await createClient()
  const { data: last } = await supabase
    .from('regions')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('regions')
    .insert({
      name,
      slug,
      description: description || null,
      kind,
      sort_order: (last?.sort_order ?? 0) + 1,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error || !data) return createError(error?.code)

  await logAction({
    action: 'region.create',
    targetType: 'region',
    targetId: data.id,
    details: { name, slug, kind },
  })
  refresh()
  return { ok: true, message: `"${name}" dibuat sebagai draft.` }
}

export async function createSubsection(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()

  const regionId = String(formData.get('regionId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const altName = String(formData.get('alt_name') ?? '').trim()

  if (!UUID.test(regionId)) return fail('Wilayah tidak valid.')
  if (name.length < 2 || name.length > 80) return fail('Nama harus 2-80 karakter.')
  const slug = resolveSlug(name, String(formData.get('slug') ?? ''))
  if (!slug) return fail('Slug tidak valid: pakai huruf kecil, angka, dan tanda hubung.')

  const supabase = await createClient()
  const { data: last } = await supabase
    .from('subsections')
    .select('sort_order')
    .eq('region_id', regionId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('subsections')
    .insert({
      region_id: regionId,
      name,
      alt_name: altName || null,
      slug,
      sort_order: (last?.sort_order ?? 0) + 1,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error || !data) return createError(error?.code)

  await logAction({
    action: 'subsection.create',
    targetType: 'subsection',
    targetId: data.id,
    details: { name, slug },
  })
  refresh()
  return { ok: true, message: `"${name}" dibuat sebagai draft.` }
}

export async function createEntry(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()

  const subsectionId = String(formData.get('subsectionId') ?? '')
  const title = String(formData.get('title') ?? '').trim()

  if (!UUID.test(subsectionId)) return fail('Sub-section tidak valid.')
  if (title.length < 2 || title.length > 120) return fail('Judul harus 2-120 karakter.')
  const slug = resolveSlug(title, String(formData.get('slug') ?? ''))
  if (!slug) return fail('Slug tidak valid: pakai huruf kecil, angka, dan tanda hubung.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lore_entries')
    .insert({ subsection_id: subsectionId, title, slug, status: 'draft' })
    .select('id')
    .single()
  if (error || !data) return createError(error?.code)

  await logAction({
    action: 'entry.create',
    targetType: 'entry',
    targetId: data.id,
    details: { title, slug },
  })
  refresh()
  return { ok: true, message: `"${title}" dibuat sebagai draft.` }
}

// ----------------------------------------------------------------- ubah

export async function updateItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()

  const type = parseType(formData.get('type'))
  const id = String(formData.get('id') ?? '')
  if (!type || !UUID.test(id)) return fail('Data tidak valid.')

  const table = TABLE[type]
  const supabase = await createClient()

  const { data: current } = await supabase
    .from(table)
    .select('slug, first_published_at')
    .eq('id', id)
    .maybeSingle()
  if (!current) return fail('Item tidak ditemukan.')

  const name = String(formData.get('name') ?? '').trim()
  if (name.length < 2 || name.length > 120) return fail('Nama harus 2-120 karakter.')

  const patch: Record<string, unknown> = { [NAME_COLUMN[type]]: name }

  if (type === 'region') {
    patch.description = String(formData.get('description') ?? '').trim() || null
    patch.kind = formData.get('kind') === 'topic' ? 'topic' : 'region'
  }
  if (type === 'subsection') {
    patch.alt_name = String(formData.get('alt_name') ?? '').trim() || null
  }

  // Slug hanya boleh berubah selama item belum pernah terbit
  const slugInput = String(formData.get('slug') ?? '').trim()
  if (slugInput && slugInput !== current.slug) {
    if (current.first_published_at) {
      return fail('Slug sudah terkunci karena item ini pernah diterbitkan.')
    }
    if (!SLUG.test(slugInput)) {
      return fail('Slug tidak valid: pakai huruf kecil, angka, dan tanda hubung.')
    }
    patch.slug = slugInput
  }

  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq('id', id)
    .select('id')
  if (error) return createError(error.code)
  if (!data || data.length === 0) return fail('Gagal menyimpan.')

  await logAction({
    action: `${type}.update`,
    targetType: type,
    targetId: id,
    details: patch,
  })
  refresh()
  return { ok: true, message: 'Tersimpan.' }
}

// --------------------------------------------------------------- status

export async function changeStatus(formData: FormData) {
  await requireLorekeeper()

  const type = parseType(formData.get('type'))
  const id = String(formData.get('id') ?? '')
  const op = String(formData.get('op') ?? '')
  if (!type || !UUID.test(id)) return

  const table = TABLE[type]
  const supabase = await createClient()

  const { data: current } = await supabase
    .from(table)
    .select('status, first_published_at')
    .eq('id', id)
    .maybeSingle()
  if (!current) return

  let next: Status | null = null
  if (op === 'publish' && current.status === 'draft') next = 'published'
  if (op === 'archive' && current.status !== 'archived') next = 'archived'
  if (op === 'restore' && current.status === 'archived') {
    next = current.first_published_at ? 'published' : 'draft'
  }
  if (!next) return

  const { data } = await supabase
    .from(table)
    .update({ status: next })
    .eq('id', id)
    .select('id')

  if (data && data.length > 0) {
    await logAction({
      action: `${type}.${op}`,
      targetType: type,
      targetId: id,
      details: { from: current.status, to: next },
    })
  }
  refresh()
}

// --------------------------------------------------------------- urutan

export async function moveItem(formData: FormData) {
  await requireLorekeeper()

  const type = parseType(formData.get('type'))
  const id = String(formData.get('id') ?? '')
  const direction = String(formData.get('direction') ?? '')
  if ((type !== 'region' && type !== 'subsection') || !UUID.test(id)) return
  if (direction !== 'up' && direction !== 'down') return

  const table = TABLE[type]
  const supabase = await createClient()

  const { data: item } = await supabase
    .from(table)
    .select(type === 'region' ? 'id, kind' : 'id, region_id')
    .eq('id', id)
    .maybeSingle()
  if (!item) return

  // Urutan hanya dibandingkan dengan saudara sekelompok
  let query = supabase.from(table).select('id, sort_order')
  query =
    type === 'region'
      ? query.eq('kind', (item as unknown as { kind: string }).kind)
      : query.eq('region_id', (item as unknown as { region_id: string }).region_id)

  const { data: siblings } = await query
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
  if (!siblings) return

  const rows = siblings as { id: string; sort_order: number }[]
  const ids = rows.map((r) => r.id)
  const i = ids.indexOf(id)
  const j = direction === 'up' ? i - 1 : i + 1
  if (i === -1 || j < 0 || j >= ids.length) return

  ;[ids[i], ids[j]] = [ids[j], ids[i]]

  // Beri nomor ulang 1..n dan perbarui hanya baris yang nomornya berubah
  const original = new Map(rows.map((r) => [r.id, r.sort_order]))
  await Promise.all(
    ids.map((sid, idx) =>
      original.get(sid) === idx + 1
        ? Promise.resolve()
        : supabase.from(table).update({ sort_order: idx + 1 }).eq('id', sid)
    )
  )

  await logAction({
    action: `${type}.move`,
    targetType: type,
    targetId: id,
    details: { direction },
  })
  refresh()
}

// ---------------------------------------------------------------- hapus

export async function deleteItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()

  const type = parseType(formData.get('type'))
  const id = String(formData.get('id') ?? '')
  const confirm = String(formData.get('confirm') ?? '').trim()
  if (!type || !UUID.test(id)) return fail('Data tidak valid.')

  const table = TABLE[type]
  const nameColumn = NAME_COLUMN[type]
  const supabase = await createClient()

  const { data: current } = await supabase
    .from(table)
    .select(`status, ${nameColumn}`)
    .eq('id', id)
    .maybeSingle()
  if (!current) return fail('Item tidak ditemukan.')

  const row = current as unknown as Record<string, string>
  const name = row[nameColumn]

  if (row.status !== 'archived') {
    return fail('Hanya item yang sudah diarsipkan yang boleh dihapus permanen.')
  }
  if (confirm !== name) return fail('Nama konfirmasi tidak cocok.')

  // Ambil ringkasan dampak SEBELUM dihapus, supaya bisa dicatat
  const { data: impact } = await supabase.rpc('delete_impact', {
    p_type: type,
    p_id: id,
  })

  const { data: mediaPaths } = await supabase.rpc('lore_media_paths', {
    p_type: type,
    p_id: id,
  })

  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')
  if (error || !data || data.length === 0) return fail('Gagal menghapus.')

  const paths = (mediaPaths as string[] | null) ?? []
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from('lore-media').remove(paths)
    if (removeError) console.error('Gagal menghapus file media:', removeError.message)
  }

  await logAction({
    action: `${type}.delete`,
    targetType: type,
    targetId: id,
    details: { name, impact },
  })
  refresh()
  return { ok: true, message: `"${name}" dihapus permanen.` }
}