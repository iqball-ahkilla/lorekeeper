'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireLorekeeper } from '@/lib/auth'
import { logAction } from '@/lib/audit'

function refresh() {
  revalidatePath('/lorekeeper')
  revalidatePath('/lore', 'layout')
}

export async function startReview(formData: FormData) {
  const user = await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')

  const supabase = await createClient()
  const { data } = await supabase
    .from('community_posts')
    .update({
      status: 'under_review',
      reviewed_by: user.id,
      review_started_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('type', 'note')
    .eq('status', 'submitted')
    .select('id')

  if (data && data.length > 0) {
    await logAction({ action: 'note.start_review', targetType: 'note', targetId: postId })
  }
  refresh()
}

export async function approveNote(formData: FormData) {
  const user = await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')

  const supabase = await createClient()
  const { data } = await supabase
    .from('community_posts')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('type', 'note')
    .eq('status', 'under_review')
    .select('id')

  if (data && data.length > 0) {
    await logAction({ action: 'note.approve', targetType: 'note', targetId: postId })
  }
  refresh()
}

export async function rejectNote(formData: FormData) {
  const user = await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (reason.length < 3 || reason.length > 1000) return

  const supabase = await createClient()
  const { data } = await supabase
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
    .select('id')

  if (data && data.length > 0) {
    await logAction({
      action: 'note.reject',
      targetType: 'note',
      targetId: postId,
      details: { reason },
    })
  }
  refresh()
}

export async function editNote(formData: FormData) {
  const user = await requireLorekeeper()
  const postId = String(formData.get('postId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  if (body.length < 1 || body.length > 2000) return

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
    .select('id')

  if (data && data.length > 0) {
    await logAction({ action: 'note.edit', targetType: 'note', targetId: postId })
  }
  refresh()
}