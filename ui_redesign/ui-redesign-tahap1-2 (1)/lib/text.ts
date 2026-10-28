// Sama dengan pola di components/RichText.tsx
const LINK = /\[\[([a-z0-9-]+(?:\/[a-z0-9-]+){0,2})\|([^\]]+)\]\]/g

// Ubah "[[mondstadt/andrius|Andrius]]" menjadi "Andrius" dan rapikan spasi
export function plainText(text: string) {
  return text.replace(LINK, '$2').replace(/\s+/g, ' ').trim()
}

// Cuplikan teks polos, dipotong di batas kata
export function excerpt(text: string, max: number) {
  const t = plainText(text)
  if (t.length <= max) return t
  return t.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

// Perkiraan menit baca (± 200 kata per menit), minimal 1
export function readMinutes(texts: string[]) {
  const words = texts.reduce((n, t) => n + plainText(t).split(' ').filter(Boolean).length, 0)
  return Math.max(1, Math.round(words / 200))
}
