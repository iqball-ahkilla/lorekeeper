'use client'

import { useRef, useState } from 'react'

export type LinkTarget = {
  path: string
  label: string
  kind: string
  search_text: string
}

type Props = {
  name: string
  defaultValue?: string
  targets: LinkTarget[]
  rows?: number
  maxLength?: number
  required?: boolean
  className?: string
}

const KIND_LABEL: Record<string, string> = {
  region: 'Wilayah',
  subsection: 'Sub-bagian',
  entry: 'Lore',
}

// Mencari "[[" yang belum ditutup tepat sebelum kursor
function activeQuery(text: string, cursor: number) {
  const before = text.slice(0, cursor)
  const open = before.lastIndexOf('[[')
  if (open === -1) return null
  const typed = before.slice(open + 2)
  if (/[\]|\n]/.test(typed)) return null // sudah ditutup atau masuk bagian teks tampil
  return { open, typed }
}

export default function LinkTextarea({
  name,
  defaultValue = '',
  targets,
  rows = 4,
  maxLength,
  required,
  className,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState(defaultValue)
  const [cursor, setCursor] = useState(0)
  const [index, setIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  const active = dismissed ? null : activeQuery(text, cursor)
  const q = active ? active.typed.trim().toLowerCase() : ''
  const matches = active
    ? targets
        .filter(
          (t) =>
            q === '' ||
            t.search_text.toLowerCase().includes(q) ||
            t.path.includes(q)
        )
        .slice(0, 8)
    : []
  const open = active !== null && matches.length > 0
  const safeIndex = open ? Math.min(index, matches.length - 1) : 0

  function sync(el: HTMLTextAreaElement) {
    setText(el.value)
    setCursor(el.selectionStart)
  }

  function choose(t: LinkTarget) {
    const el = ref.current
    if (!el || !active) return

    const insert = `[[${t.path}|${t.label}]]`
    const next = el.value.slice(0, active.open) + insert + el.value.slice(cursor)
    const pos = active.open + insert.length

    el.value = next
    el.focus()
    el.setSelectionRange(pos, pos)
    setText(next)
    setCursor(pos)
    setIndex(0)
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        maxLength={maxLength}
        required={required}
        className={className}
        onChange={(e) => {
          sync(e.currentTarget)
          setIndex(0)
          setDismissed(false)
        }}
        onKeyUp={(e) => sync(e.currentTarget)}
        onClick={(e) => sync(e.currentTarget)}
        onFocus={(e) => sync(e.currentTarget)}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIndex((safeIndex + 1) % matches.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIndex((safeIndex - 1 + matches.length) % matches.length)
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            choose(matches[safeIndex])
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setDismissed(true)
          }
        }}
      />

      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-surface-2 text-sm text-fg shadow-xl shadow-black/40"
        >
          {matches.map((t, i) => (
            <li
              key={t.path}
              role="option"
              aria-selected={i === safeIndex}
              onMouseDown={(e) => {
                e.preventDefault() // jaga fokus tetap di textarea
                choose(t)
              }}
              className={`cursor-pointer px-3 py-2 ${
                i === safeIndex ? 'bg-gold/20 text-gold' : 'hover:bg-surface'
              }`}
            >
              <span className="font-medium">{t.label}</span>
              <span className="ml-2 text-xs text-muted">
                {KIND_LABEL[t.kind] ?? t.kind} · {t.path}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}