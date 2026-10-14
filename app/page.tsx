import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'

async function HelloMessage() {
  const { data, error } = await supabase.from('hello').select('message')

  if (error) return <p>Error: {error.message}</p>

  return <p>{data?.[0]?.message ?? 'Tabel kosong'}</p>
}

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Lore Wiki</h1>
      <Suspense fallback={<p>Memuat...</p>}>
        <HelloMessage />
      </Suspense>
    </main>
  )
}