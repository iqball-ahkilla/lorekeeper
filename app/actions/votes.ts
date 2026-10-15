'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'

// Satu aksi untuk dua arah: kalau sudah vote maka ditarik, kalau belum maka ditambah
export async function toggleVote(formData: FormData) {
  const user = await requireUser()
  const postId = String(formData.get('postId') ?? '')

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('note_votes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('note_votes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id)
  } else {
    await supabase.from('note_votes').insert({ post_id: postId, user_id: user.id })
  }

  revalidatePath('/lorekeeper')
  revalidatePath('/lore', 'layout')
}