import { supabase } from '@/lib/supabase'
import { youtubeId } from '@/lib/youtube'

export type Media = {
  id: string
  media_type: 'image' | 'video'
  media_url: string
  caption: string | null
  sort_order: number
}

export default function BlockMedia({ items }: { items: Media[] }) {
  if (!items || items.length === 0) return null

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="mb-3 space-y-4">
      {sorted.map((m) => {
        if (m.media_type === 'image') {
          // media_url berisi path file di bucket lore-media
          const { data } = supabase.storage.from('lore-media').getPublicUrl(m.media_url)
          return (
            <figure key={m.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.publicUrl}
                alt={m.caption ?? ''}
                loading="lazy"
                className="max-h-96 w-full rounded object-contain"
              />
              {m.caption && (
                <figcaption className="mt-1 text-center text-xs opacity-60">
                  {m.caption}
                </figcaption>
              )}
            </figure>
          )
        }

        // media_url berisi link YouTube
        const id = youtubeId(m.media_url)
        if (!id) return null
        return (
          <figure key={m.id}>
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${id}`}
                title={m.caption ?? 'Video'}
                loading="lazy"
                allowFullScreen
                className="h-full w-full rounded"
              />
            </div>
            {m.caption && (
              <figcaption className="mt-1 text-center text-xs opacity-60">
                {m.caption}
              </figcaption>
            )}
          </figure>
        )
      })}
    </div>
  )
}