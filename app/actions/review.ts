'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireLorekeeper } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import type { ActionState } from '@/app/actions/structure'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (message: string): ActionState => ({ ok: false, message })

function refresh() {
  revalidatePath('/lorekeeper', 'layout')
  revalidatePath('/lore', 'layout')
  revalidatePath('/catatan-saya')
}

// Semua transisi status lewat satu fungsi database (atomik, termasuk audit log)
async function review(
  postId: string,
  action: 'start' | 'approve' | 'reject',
  reason: string | null,
  successMessage: string
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('review_note', {
    p_post_id: postId,
    p_action: action,
    p_reason: reason,
  })

  if (error) {
    // Pesan dari RAISE EXCEPTION (P0001) aman ditampilkan
    return fail(error.code === 'P0001' ? error.message : 'Aksi gagal. Coba lagi.')
  }

  refresh()
  return { ok: true, message: successMessage }
}

export async function startReview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')
  if (!UUID.test(postId)) return fail('Data tidak valid.')
  return review(postId, 'start', null, 'Review dimulai.')
}

export async function approveNote(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')
  if (!UUID.test(postId)) return fail('Data tidak valid.')
  return review(postId, 'approve', null, 'Catatan disetujui.')
}

// Dipakai untuk Tolak (dari submitted/under_review) dan Cabut persetujuan (dari approved)
export async function rejectNote(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (!UUID.test(postId)) return fail('Data tidak valid.')
  if (reason.length < 3 || reason.length > 1000) {
    return fail('Alasan wajib diisi (3-1000 karakter).')
  }
  return review(postId, 'reject', reason, 'Catatan ditolak.')
}

// Lorekeeper memperbaiki teks note (typo, tautan). Evidence tidak ikut diubah.
export async function editNote(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')
  const body = String(formData.get('body') ?? '').trim()

  if (!UUID.test(postId)) return fail('Data tidak valid.')
  if (body.length < 1 || body.length > 2000) return fail('Teks harus 1-2000 karakter.')

  const supabase = await createClient()
  const { data } = await supabase
    .from('community_posts')
    .update({
      body,
      edited_by: user.id,
      edited_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('type', 'note')
    .is('deleted_at', null)
    .select('id')

  if (!data || data.length === 0) return fail('Gagal menyimpan.')

  await logAction({ action: 'note.edit', targetType: 'note', targetId: postId })
  refresh()
  return { ok: true, message: 'Tersimpan.' }
}