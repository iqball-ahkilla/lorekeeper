'use client'

import { useSyncExternalStore } from 'react'
import { formatDateWIB, formatWIB, relativeLabel } from '@/lib/time'

// "Sekarang" dibulatkan ke menit dan diperbarui tiap 30 detik
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 30_000)
  return () => clearInterval(id)
}

function getSnapshot() {
  return Math.floor(Date.now() / 60_000) * 60_000
}

// Di server tidak ada jam "sekarang": tampilkan tanggal biasa dulu
function getServerSnapshot() {
  return null
}

export default function RelativeTime({
  iso,
  className,
}: {
  iso: string
  className?: string
}) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const text =
    now === null ? formatDateWIB(iso) : (relativeLabel(iso, now) ?? formatDateWIB(iso))

  return (
    <time dateTime={iso} title={formatWIB(iso)} className={className}>
      {text}
    </time>
  )
}