'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import type { ActionState } from '@/app/actions/structure'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (message: string): ActionState => ({ ok: false, message })

// Pesan dari RAISE EXCEPTION (kode P0001) aman ditampilkan; error lain disamarkan
function dbMessage(error: { code?: string; message: string }, fallback: string) {
  return error.code === 'P0001' ? error.message : fallback
}

function refresh() {
  revalidatePath('/lore', 'layout')
  revalidatePath('/lorekeeper', 'layout')
  revalidatePath('/catatan-saya')
}

export async function editComment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser()

  const postId = String(formData.get('postId') ?? '')
  const body = String(formData.get('body') ?? '').trim()

  if (!UUID.test(postId)) return fail('Data tidak valid.')
  if (body.length < 1 || body.length > 2000) return fail('Komentar harus 1-2000 karakter.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('edit_comment', { p_post_id: postId, p_body: body })
  if (error) return fail(dbMessage(error, 'Gagal menyimpan.'))

  refresh()
  return { ok: true, message: 'Tersimpan.' }
}

export async function deleteComment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser()

  const postId = String(formData.get('postId') ?? '')
  if (!UUID.test(postId)) return fail('Data tidak valid.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_comment', { p_post_id: postId })
  if (error) return fail(dbMessage(error, 'Gagal menghapus komentar.'))

  refresh()
  return { ok: true, message: 'Komentar dihapus.' }
}