const WIB = 'Asia/Jakarta'

// "17 Okt 2026" (tanggal saja, zona WIB)
export function formatDateWIB(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    timeZone: WIB,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// "17 Okt 2026 14.35 WIB" (dengan detik untuk riwayat aktivitas)
export function formatWIB(iso: string, withSeconds = false) {
  const text = new Date(iso).toLocaleString('id-ID', {
    timeZone: WIB,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  })
  return `${text} WIB`
}

// Teks relatif ala Facebook/Instagram. Mengembalikan null kalau sudah lebih dari 7 hari
// (pemanggil lalu menampilkan tanggal). Jam "sekarang" dikirim oleh pemanggil.
export function relativeLabel(iso: string, nowMs: number): string | null {
  const diff = Math.max(0, nowMs - new Date(iso).getTime())
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'Baru saja'
  if (diff < hour) return `${Math.floor(diff / minute)} menit lalu`
  if (diff < day) return `${Math.floor(diff / hour)} jam lalu`
  if (diff < 7 * day) return `${Math.floor(diff / day)} hari lalu`
  return null
}