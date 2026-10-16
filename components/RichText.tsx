import Link from 'next/link'

// Hanya path internal yang diterima: huruf kecil, angka, tanda hubung, maksimal 3 segmen
const LINK = /\[\[([a-z0-9-]+(?:\/[a-z0-9-]+){0,2})\|([^\]]+)\]\]/g

export default function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let last = 0

  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <Link key={start} href={`/lore/${m[1]}`} className="text-blue-500 hover:underline">
        {m[2]}
      </Link>
    )
    last = start + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))

  return <>{parts}</>
}