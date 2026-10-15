import { Suspense } from 'react'
import { requireLorekeeper } from '@/lib/auth'

async function LorekeeperContent() {
  const user = await requireLorekeeper()

  return (
    <>
      <h1 className="text-2xl font-bold">Panel Lorekeeper</h1>
      <p className="mt-2">
        Halo, {user.username}. Antrian review note akan muncul di sini pada Fase 4.
      </p>
    </>
  )
}

export default function LorekeeperPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <Suspense fallback={<p>Memuat...</p>}>
        <LorekeeperContent />
      </Suspense>
    </main>
  )
}