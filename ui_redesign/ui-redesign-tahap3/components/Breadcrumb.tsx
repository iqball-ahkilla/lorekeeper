import Link from 'next/link'

export type Crumb = {
  label: string
  href?: string // tanpa href = halaman saat ini
  sub?: string // teks kecil di samping label (mis. nama alternatif)
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Jejak halaman" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden="true" className="text-faint">
                /
              </span>
            )}
            {c.href ? (
              <Link href={c.href} className="text-muted hover:text-fg">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-gold">
                {c.label}
              </span>
            )}
            {c.sub && <span className="text-xs text-faint/80">{c.sub}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
