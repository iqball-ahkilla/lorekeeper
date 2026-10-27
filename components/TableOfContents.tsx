type Heading = { id: string; text: string; level: 2 | 3 }

export default function TableOfContents({ headings }: { headings: Heading[] }) {
  // Daftar isi hanya berguna kalau ada minimal dua heading
  if (headings.length < 2) return null

  return (
    <details open={headings.length <= 8} className="mt-6 rounded border border-gray-400 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Daftar isi</summary>
      <ol className="mt-3 space-y-1 text-sm">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? 'ml-4' : ''}>
            <a href={`#blok-${h.id}`} className="text-blue-500 hover:underline">
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </details>
  )
}