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
    <div className="mb-4 space-y-4">
      {sorted.map((m) => {
        if (m.media_type === 'image') {
          // media_url berisi path file di bucket lore-media
          const { data } = supabase.storage.from('lore-media').getPublicUrl(m.media_url)
          return (
            <figure key={m.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.publicUrl}
                alt={m.caption ?? ''}
                loading="lazy"
                className="max-h-[28rem] w-full bg-deep object-contain"
              />
              {m.caption && (
                <figcaption className="border-t border-line px-4 py-2 text-xs text-muted">
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
          <figure key={m.id} className="card overflow-hidden">
            <div className="aspect-video bg-deep">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${id}`}
                title={m.caption ?? 'Video'}
                loading="lazy"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
            {m.caption && (
              <figcaption className="border-t border-line px-4 py-2 text-xs text-muted">
                {m.caption}
              </figcaption>
            )}
          </figure>
        )
      })}
    </div>
  )
}