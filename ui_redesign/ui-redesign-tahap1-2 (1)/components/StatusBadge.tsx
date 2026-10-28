export type ContentStatus = 'draft' | 'published' | 'archived'

const STYLE: Record<ContentStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gold/15 text-gold' },
  published: { label: 'Terbit', className: 'bg-emerald-500/15 text-emerald-300' },
  archived: { label: 'Arsip', className: 'bg-white/10 text-muted' },
}

export default function StatusBadge({
  status,
  hidePublished = false,
}: {
  status: ContentStatus
  hidePublished?: boolean
}) {
  if (hidePublished && status === 'published') return null
  const s = STYLE[status]
  return <span className={`rounded px-2 py-0.5 text-xs ${s.className}`}>{s.label}</span>
}