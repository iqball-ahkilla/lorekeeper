'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireLorekeeper } from '@/lib/auth'

import { logAction } from '@/lib/audit'

export type ContentState = { ok: boolean; message: string } | null

export async function updateParagraph(
  _prev: ContentState,
  formData: FormData
): Promise<ContentState> {
  await requireLorekeeper()

  const blockId = String(formData.get('blockId') ?? '')
  const body = String(formData.get('body') ?? '').trim()

  if (!blockId) return { ok: false, message: 'Paragraf tidak valid.' }
  if (body.length < 1 || body.length > 5000) {
    return { ok: false, message: 'Teks harus 1-5000 karakter.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_blocks')
    .update({ body })
    .eq('id', blockId)
    .select('id')

  // RLS yang menolak tidak menghasilkan error, hanya nol baris yang berubah
  if (error || !data || data.length === 0) {
    return { ok: false, message: 'Gagal menyimpan.' }
  }

  await logAction({ action: 'block.edit', targetType: 'content_block', targetId: blockId })

  revalidatePath('/lore', 'layout')
  revalidatePath('/lorekeeper', 'layout')
  return { ok: true, message: 'Tersimpan.' }
}