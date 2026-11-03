// Lingkaran berisi huruf pertama username (tanpa gambar profil)
export default function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-16 w-16 text-2xl' : size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base'
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-serif font-semibold text-gold ${dim}`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
