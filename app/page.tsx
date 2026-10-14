import { supabase } from '@/lib/supabase'

// Paksa halaman diambil ulang tiap dibuka, bukan dibekukan saat build
export const dynamic = 'force-dynamic'

export default async function Home() {
  const { data, error } = await supabase.from('hello').select('message')

  if (error) return <p>Error: {error.message}</p>

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Lore Wiki</h1>
      <p>{data?.[0]?.message ?? 'Tabel kosong'}</p>
    </main>
  )
}