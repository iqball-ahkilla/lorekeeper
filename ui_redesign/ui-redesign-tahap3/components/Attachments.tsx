import { supabase } from '@/lib/supabase'

export type Attachment = {
  id: string
  file_path: string
  file_name: string
  file_type: 'image' | 'document'
}

export default function Attachments({ items }: { items: Attachment[] | null }) {
  if (!items || items.length === 0) return null

  return (
    <ul className="mt-2 flex flex-wrap gap-3">
      {items.map((a) => {
        const url = supabase.storage.from('evidence').getPublicUrl(a.file_path).data.publicUrl
        return (
          <li key={a.id}>
            {a.file_type === 'image' ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={a.file_name}
                  loading="lazy"
                  className="h-24 w-24 rounded border border-line object-cover"
                />
              </a>
            ) : (
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-gold underline">
                Dokumen: {a.file_name}
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}