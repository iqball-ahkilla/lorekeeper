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

type AttachmentInput = { path: string; name: string; type: 'image' | 'document' }

// Menarik (soft delete) note milik sendiri
export async function withdrawNote(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser()

  const postId = String(formData.get('postId') ?? '')
  if (!UUID.test(postId)) return fail('Data tidak valid.')

  const supabase = await createClient()
  const { data: removed, error } = await supabase.rpc('withdraw_note', {
    p_post_id: postId,
  })
  if (error) return fail(dbMessage(error, 'Gagal menarik catatan.'))

  // Transaksi database sudah berhasil; bersihkan file lampiran di Storage
  const paths = (removed as string[] | null) ?? []
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from('evidence').remove(paths)
    if (removeError) console.error('Gagal menghapus file lampiran:', removeError.message)
  }

  refresh()
  return { ok: true, message: 'Catatan ditarik.' }
}

// Dipanggil langsung dari komponen klien setelah file baru terunggah
export async function editOwnNote(formData: FormData): Promise<ActionState> {
  const user = await requireUser()

  const postId = String(formData.get('postId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  const evidence = String(formData.get('evidence') ?? '').trim()

  let keep: string[] = []
  let attachments: AttachmentInput[] = []
  try {
    keep = JSON.parse(String(formData.get('keep') ?? '[]'))
    attachments = JSON.parse(String(formData.get('attachments') ?? '[]'))
  } catch {
    return fail('Data lampiran tidak valid.')
  }

  if (!UUID.test(postId)) return fail('Data tidak valid.')
  if (body.length < 1 || body.length > 2000) return fail('Catatan harus 1-2000 karakter.')
  if (evidence.length > 2000) return fail('Bukti teks maksimal 2000 karakter.')

  if (!Array.isArray(keep) || !keep.every((id) => typeof id === 'string' && UUID.test(id))) {
    return fail('Data lampiran tidak valid.')
  }
  if (!Array.isArray(attachments) || keep.length + attachments.length > 2) {
    return fail('Maksimal 2 lampiran.')
  }
  for (const a of attachments) {
    const valid =
      typeof a.path === 'string' &&
      a.path.startsWith(`${user.id}/`) &&
      !a.path.includes('..') &&
      typeof a.name === 'string' &&
      a.name.length > 0 &&
      a.name.length <= 200 &&
      (a.type === 'image' || a.type === 'document')
    if (!valid) return fail('Lampiran tidak valid.')
  }
  if (evidence.length === 0 && keep.length + attachments.length === 0) {
    return fail('Bukti wajib: isi teks atau lampirkan minimal satu file.')
  }

  const supabase = await createClient()
  const { data: removed, error } = await supabase.rpc('edit_note', {
    p_post_id: postId,
    p_body: body,
    p_evidence: evidence,
    p_keep_ids: keep,
    p_new_attachments: attachments,
  })
  if (error) return fail(dbMessage(error, 'Gagal menyimpan.'))

  const paths = (removed as string[] | null) ?? []
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from('evidence').remove(paths)
    if (removeError) console.error('Gagal menghapus file lampiran:', removeError.message)
  }

  refresh()
  return { ok: true, message: 'Tersimpan.' }
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