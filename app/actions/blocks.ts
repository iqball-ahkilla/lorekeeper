'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireLorekeeper } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import type { ActionState } from '@/app/actions/structure'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (message: string): ActionState => ({ ok: false, message })

type Kind = {
  block_type: 'heading' | 'paragraph' | 'quote'
  heading_level: number | null
}

function parseKind(v: string): Kind | null {
  switch (v) {
    case 'paragraph':
      return { block_type: 'paragraph', heading_level: null }
    case 'quote':
      return { block_type: 'quote', heading_level: null }
    case 'heading2':
      return { block_type: 'heading', heading_level: 2 }
    case 'heading3':
      return { block_type: 'heading', heading_level: 3 }
    default:
      return null
  }
}

// Pesan dari RAISE EXCEPTION (kode P0001) aman ditampilkan; error lain disamarkan
function dbMessage(error: { code?: string; message: string }, fallback: string) {
  return error.code === 'P0001' ? error.message : fallback
}

function refresh() {
  revalidatePath('/lorekeeper', 'layout')
  revalidatePath('/lore', 'layout')
}

export async function updateBlock(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()

  const blockId = String(formData.get('blockId') ?? '')
  const kind = parseKind(String(formData.get('kind') ?? ''))
  const body = String(formData.get('body') ?? '').trim()

  if (!UUID.test(blockId) || !kind) return fail('Data tidak valid.')
  if (body.length < 1 || body.length > 5000) return fail('Teks harus 1-5000 karakter.')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_blocks')
    .update({
      body,
      block_type: kind.block_type,
      heading_level: kind.heading_level,
    })
    .eq('id', blockId)
    .select('id')

  if (error) return fail(dbMessage(error, 'Gagal menyimpan.'))
  if (!data || data.length === 0) return fail('Gagal menyimpan.')

  await logAction({
    action: 'block.edit',
    targetType: 'content_block',
    targetId: blockId,
    details: { type: kind.block_type },
  })
  refresh()
  return { ok: true, message: 'Tersimpan.' }
}

export async function addBlock(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()

  const entryId = String(formData.get('entryId') ?? '')
  const position = String(formData.get('position') ?? '')
  const afterId = String(formData.get('afterBlockId') ?? '')
  const kind = parseKind(String(formData.get('kind') ?? ''))
  const body = String(formData.get('body') ?? '').trim()

  if (!UUID.test(entryId) || !kind) return fail('Data tidak valid.')
  if (position !== 'start' && position !== 'end' && position !== 'after') {
    return fail('Posisi tidak valid.')
  }
  if (position === 'after' && !UUID.test(afterId)) return fail('Blok acuan tidak valid.')
  if (body.length < 1 || body.length > 5000) return fail('Teks harus 1-5000 karakter.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_block', {
    p_entry_id: entryId,
    p_after_block_id: position === 'after' ? afterId : null,
    p_at_start: position === 'start',
    p_block_type: kind.block_type,
    p_heading_level: kind.heading_level,
    p_body: body,
  })
  if (error) return fail(dbMessage(error, 'Gagal menambah blok.'))

  refresh()
  return { ok: true, message: 'Blok ditambahkan.' }
}

export async function moveBlock(formData: FormData) {
  await requireLorekeeper()

  const blockId = String(formData.get('blockId') ?? '')
  const direction = String(formData.get('direction') ?? '')
  if (!UUID.test(blockId) || (direction !== 'up' && direction !== 'down')) return

  const supabase = await createClient()
  await supabase.rpc('move_block', { p_block_id: blockId, p_direction: direction })
  refresh()
}

export async function deleteBlock(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()

  const blockId = String(formData.get('blockId') ?? '')
  if (!UUID.test(blockId)) return fail('Data tidak valid.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_block', { p_block_id: blockId })
  if (error) return fail(dbMessage(error, 'Gagal menghapus blok.'))

  refresh()
  return { ok: true, message: 'Blok dihapus.' }
}