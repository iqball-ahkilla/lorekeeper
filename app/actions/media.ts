'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireLorekeeper } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { youtubeId } from '@/lib/youtube'
import type { ActionState } from '@/app/actions/structure'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (message: string): ActionState => ({ ok: false, message })

function refresh() {
  revalidatePath('/lorekeeper', 'layout')
  revalidatePath('/lore', 'layout')
}

// Dipanggil langsung dari komponen klien setelah file gambar terunggah
export async function addMedia(formData: FormData): Promise<ActionState> {
  await requireLorekeeper()

  const blockId = String(formData.get('blockId') ?? '')
  const mediaType = String(formData.get('mediaType') ?? '')
  const mediaUrl = String(formData.get('mediaUrl') ?? '').trim()
  const caption = String(formData.get('caption') ?? '').trim()

  if (!UUID.test(blockId)) return fail('Blok tidak valid.')
  if (mediaType !== 'image' && mediaType !== 'video') return fail('Jenis media tidak valid.')
  if (caption.length > 200) return fail('Caption maksimal 200 karakter.')

  const supabase = await createClient()

  const { data: block } = await supabase
    .from('content_blocks')
    .select('lore_entry_id')
    .eq('id', blockId)
    .maybeSingle()
  if (!block) return fail('Blok tidak ditemukan.')

  let stored = mediaUrl
  if (mediaType === 'image') {
    // Jangan percaya path dari browser: harus di folder entry ini dan berekstensi gambar
    const pattern = new RegExp(
      `^${block.lore_entry_id}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp)$`,
      'i'
    )
    if (!pattern.test(mediaUrl)) return fail('Path gambar tidak valid.')
  } else {
    const id = youtubeId(mediaUrl)
    if (!id) return fail('Link YouTube tidak valid.')
    stored = `https://www.youtube.com/watch?v=${id}`
  }

  const { data: last } = await supabase
    .from('block_media')
    .select('sort_order')
    .eq('content_block_id', blockId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('block_media')
    .insert({
      content_block_id: blockId,
      media_type: mediaType,
      media_url: stored,
      caption: caption || null,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select('id')
    .single()
  if (error || !data) return fail('Gagal menyimpan media.')

  await logAction({
    action: 'media.create',
    targetType: 'block_media',
    targetId: data.id,
    details: { type: mediaType, block_id: blockId },
  })
  refresh()
  return { ok: true, message: 'Media ditambahkan.' }
}

export async function updateMedia(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireLorekeeper()

  const mediaId = String(formData.get('mediaId') ?? '')
  const caption = String(formData.get('caption') ?? '').trim()

  if (!UUID.test(mediaId)) return fail('Data tidak valid.')
  if (caption.length > 200) return fail('Caption maksimal 200 karakter.')

  const supabase = await createClient()
  const { data } = await supabase
    .from('block_media')
    .update({ caption: caption || null })
    .eq('id', mediaId)
    .select('id')
  if (!data || data.length === 0) return fail('Gagal menyimpan.')

  await logAction({ action: 'media.edit', targetType: 'block_media', targetId: mediaId })
  refresh()
  return { ok: true, message: 'Tersimpan.' }
}

export async function moveMedia(formData: FormData) {
  await requireLorekeeper()

  const mediaId = String(formData.get('mediaId') ?? '')
  const direction = String(formData.get('direction') ?? '')
  if (!UUID.test(mediaId) || (direction !== 'up' && direction !== 'down')) return

  const supabase = await createClient()

  const { data: item } = await supabase
    .from('block_media')
    .select('content_block_id')
    .eq('id', mediaId)
    .maybeSingle()
  if (!item) return

  const { data: siblings } = await supabase
    .from('block_media')
    .select('id, sort_order')
    .eq('content_block_id', item.content_block_id)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
  if (!siblings) return

  const rows = siblings as { id: string; sort_order: number }[]
  const ids = rows.map((r) => r.id)
  const i = ids.indexOf(mediaId)
  const j = direction === 'up' ? i - 1 : i + 1
  if (i === -1 || j < 0 || j >= ids.length) return

  ;[ids[i], ids[j]] = [ids[j], ids[i]]

  const original = new Map(rows.map((r) => [r.id, r.sort_order]))
  await Promise.all(
    ids.map((id, idx) =>
      original.get(id) === idx + 1
        ? Promise.resolve()
        : supabase.from('block_media').update({ sort_order: idx + 1 }).eq('id', id)
    )
  )

  await logAction({
    action: 'media.move',
    targetType: 'block_media',
    targetId: mediaId,
    details: { direction },
  })
  refresh()
}

export async function deleteMedia(formData: FormData) {
  await requireLorekeeper()

  const mediaId = String(formData.get('mediaId') ?? '')
  if (!UUID.test(mediaId)) return

  const supabase = await createClient()

  const { data: media } = await supabase
    .from('block_media')
    .select('media_type, media_url')
    .eq('id', mediaId)
    .maybeSingle()
  if (!media) return

  const { data } = await supabase
    .from('block_media')
    .delete()
    .eq('id', mediaId)
    .select('id')
  if (!data || data.length === 0) return

  // Baris sudah terhapus; bersihkan file gambarnya di Storage
  if (media.media_type === 'image') {
    const { error } = await supabase.storage.from('lore-media').remove([media.media_url])
    if (error) console.error('Gagal menghapus file media:', error.message)
  }

  await logAction({
    action: 'media.delete',
    targetType: 'block_media',
    targetId: mediaId,
    details: { type: media.media_type, url: media.media_url },
  })
  refresh()
}