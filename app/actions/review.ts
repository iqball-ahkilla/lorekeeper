'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireLorekeeper } from '@/lib/auth'

function refresh() {
  revalidatePath('/lorekeeper')
  revalidatePath('/lore', 'layout')
}

// Lorekeeper menandai note sedang direview, dan badge publik muncul
export async function startReview(formData: FormData) {
  const user = await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')

  const supabase = await createClient()
  await supabase
    .from('community_posts')
    .update({ status: 'under_review', reviewed_by: user.id })
    .eq('id', postId)
    .eq('type', 'note')
    .eq('status', 'submitted')

  refresh()
}

export async function approveNote(formData: FormData) {
  const user = await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')

  const supabase = await createClient()
  await supabase
    .from('community_posts')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('type', 'note')
    .eq('status', 'under_review')

  refresh()
}

export async function rejectNote(formData: FormData) {
  const user = await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (reason.length < 3 || reason.length > 1000) return

  const supabase = await createClient()
  await supabase
    .from('community_posts')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('type', 'note')
    .eq('status', 'under_review')

  refresh()
}

// Memperbaiki typo/menyisipkan teks; evidence dan alasan penolakan tidak disentuh
export async function editNote(formData: FormData) {
  const user = await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  if (body.length < 1 || body.length > 2000) return

  const supabase = await createClient()
  await supabase
    .from('community_posts')
    .update({
      body,
      edited_by: user.id,
      edited_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('type', 'note')

  refresh()
}