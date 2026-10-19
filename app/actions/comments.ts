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

  if (body.length < 1 || body.length > 2000) {
    return { error: 'Catatan harus 1-2000 karakter.' }
  }
  if (evidence.length > 2000) {
    return { error: 'Bukti teks maksimal 2000 karakter.' }
  }

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

  if (evidence.length === 0 && attachments.length === 0) {
    return { error: 'Bukti wajib: isi teks atau lampirkan minimal satu file.' }
  }

  const supabase = await createClient()

  const { data: block } = await supabase
    .from('content_blocks')
    .select('id')
    .eq('id', blockId)
    .eq('lore_entry_id', entryId)
    .maybeSingle()
  if (!block) return { error: 'Paragraf tidak valid.' }

  const { data: created, error } = await supabase
    .from('community_posts')
    .insert({
      lore_entry_id: entryId,
      content_block_id: blockId,
      author_id: user.id,
      type: 'note',
      status: 'submitted',
      body,
      evidence_text: evidence || null,
    })
    .select('id')
    .single()
  if (error || !created) return { error: 'Gagal mengajukan catatan.' }

  if (attachments.length > 0) {
    const { error: attachError } = await supabase.from('note_attachments').insert(
      attachments.map((a) => ({
        post_id: created.id,
        file_path: a.path,
        file_name: a.name,
        file_type: a.type,
      }))
    )
    if (attachError) {
      revalidatePath('/lore', 'layout')
      return { error: 'Catatan terkirim, tetapi lampiran gagal disimpan.' }
    }
  }

  revalidatePath('/lore', 'layout')
  return { error: null }
}
// export async function submitNote(
//   _prev: CommentState,
//   formData: FormData
// ): Promise<CommentState> {
//   const user = await getCurrentUser()
//   if (!user) return { error: 'Kamu harus masuk dulu.' }

//   const entryId = String(formData.get('entryId') ?? '')
//   const blockId = String(formData.get('contentBlockId') ?? '')
//   const body = String(formData.get('body') ?? '').trim()
//   const evidence = String(formData.get('evidence') ?? '').trim()

//   if (body.length < 1 || body.length > 2000) {
//     return { error: 'Catatan harus 1-2000 karakter.' }
//   }
//   if (evidence.length < 1 || evidence.length > 2000) {
//     return { error: 'Bukti wajib diisi (maksimal 2000 karakter).' }
//   }

//   const supabase = await createClient()

//   // Pastikan paragraf yang dipilih memang milik entry ini
//   const { data: block } = await supabase
//     .from('content_blocks')
//     .select('id')
//     .eq('id', blockId)
//     .eq('lore_entry_id', entryId)
//     .maybeSingle()
//   if (!block) return { error: 'Paragraf tidak valid.' }

//   const { error } = await supabase.from('community_posts').insert({
//     lore_entry_id: entryId,
//     content_block_id: blockId,
//     author_id: user.id,
//     type: 'note',
//     status: 'submitted',
//     body,
//     evidence_text: evidence,
//   })
//   if (error) return { error: 'Gagal mengajukan catatan.' }

//   revalidatePath('/lore', 'layout')
//   return { error: null }
// }