type Heading = { id: string; text: string; level: 2 | 3 }

export default function TableOfContents({ headings }: { headings: Heading[] }) {
  // Daftar isi hanya berguna kalau ada minimal dua heading
  if (headings.length < 2) return null

  // Heading level 2 diberi nomor urut (01, 02, ...); level 3 menjorok tanpa nomor
  let n = 0

  return (
    <nav aria-label="Daftar isi" className="card p-4">
      <details open={headings.length <= 8}>
        <summary className="eyebrow cursor-pointer">Daftar isi</summary>
        <ol className="mt-3 space-y-1.5 text-sm">
          {headings.map((h) => {
            const num = h.level === 2 ? String(++n).padStart(2, '0') : null
            return (
              <li key={h.id} className={`flex gap-2 ${h.level === 3 ? 'ml-6' : ''}`}>
                {num && <span className="font-mono text-xs leading-5 text-gold-dim">{num}</span>}
                <a href={`#blok-${h.id}`} className="text-muted hover:text-gold">
                  {h.text}
                </a>
              </li>
            )
          })}
        </ol>
      </details>
    </nav>
  )
}
