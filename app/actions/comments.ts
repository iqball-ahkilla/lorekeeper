'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export type CommentState = { error: string | null } | null

export async function addComment(
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Kamu harus masuk dulu.' }

  const body = String(formData.get('body') ?? '').trim()
  const entryId = String(formData.get('entryId') ?? '')
  const parentId = String(formData.get('parentId') ?? '') || null

  if (body.length < 1 || body.length > 2000) {
    return { error: 'Komentar harus 1-2000 karakter.' }
  }

  const supabase = await createClient()

  // Kalau ini balasan: pastikan induknya ada, satu entry, dan komentar utama
  if (parentId) {
    const { data: parent } = await supabase
      .from('community_posts')
      .select('id, lore_entry_id, parent_id, deleted_at')
      .eq('id', parentId)
      .maybeSingle()

    if (
      !parent ||
      parent.lore_entry_id !== entryId ||
      parent.parent_id !== null ||
      parent.deleted_at !== null
    ) {
      return { error: 'Komentar yang dibalas tidak valid.' }
    }
  }

  const { error } = await supabase.from('community_posts').insert({
    lore_entry_id: entryId,
    parent_id: parentId,
    author_id: user.id,
    type: 'comment',
    body,
  })
  if (error) return { error: 'Gagal mengirim komentar.' }

  revalidatePath('/lore', 'layout')
  return { error: null }
}

type AttachmentInput = { path: string; name: string; type: 'image' | 'document' }

export async function submitNote(
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Kamu harus masuk dulu.' }

  const entryId = String(formData.get('entryId') ?? '')
  const blockId = String(formData.get('contentBlockId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  const evidence = String(formData.get('evidence') ?? '').trim()

  // Validasi ulang daftar lampiran di server: jangan percaya data dari browser
  let attachments: AttachmentInput[] = []
  try {
    attachments = JSON.parse(String(formData.get('attachments') ?? '[]'))
  } catch {
    return { error: 'Data lampiran tidak valid.' }
  }
  if (!Array.isArray(attachments) || attachments.length > 2) {
    return { error: 'Maksimal 2 lampiran.' }
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
    if (!valid) return { error: 'Lampiran tidak valid.' }
  }

  // Note dan lampirannya disimpan dalam satu transaksi database
  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_note', {
    p_entry_id: entryId,
    p_block_id: blockId,
    p_body: body,
    p_evidence: evidence,
    p_attachments: attachments,
  })
  if (error) {
    return { error: error.code === 'P0001' ? error.message : 'Gagal mengajukan catatan.' }
  }

  revalidatePath('/lore', 'layout')
  return { error: null }
}