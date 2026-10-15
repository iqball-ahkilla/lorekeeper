import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type CurrentUser = {
  id: string
  username: string
  role: 'member' | 'lorekeeper'
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  await connection() // membaca waktu/cookie: hanya boleh saat ada request nyata

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) return null

  const { data: row } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('id', userId)
    .maybeSingle()
  if (!row) return null

  return { id: userId, username: row.username, role: row.role }
}

export async function requireLorekeeper(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')            // belum login
  if (user.role !== 'lorekeeper') redirect('/') // login tapi bukan lorekeeper
  return user
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}