export type ContentStatus = 'draft' | 'published' | 'archived'

const STYLE: Record<ContentStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-500/20 text-yellow-600' },
  published: { label: 'Terbit', className: 'bg-green-500/20 text-green-600' },
  archived: { label: 'Arsip', className: 'bg-gray-500/20 text-gray-500' },
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