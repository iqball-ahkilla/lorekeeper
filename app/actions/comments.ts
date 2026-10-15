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
      .select('id, lore_entry_id, parent_id')
      .eq('id', parentId)
      .maybeSingle()

    if (!parent || parent.lore_entry_id !== entryId || parent.parent_id !== null) {
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