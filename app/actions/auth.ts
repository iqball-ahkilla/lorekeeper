'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type AuthState = { error: string } | null

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get('username') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return { error: 'Username 3-20 karakter: huruf, angka, atau underscore.' }
  }
  if (password.length < 8) {
    return { error: 'Password minimal 8 karakter.' }
  }

  const supabase = await createClient()

  // Cek dulu apakah username sudah dipakai
  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (taken) return { error: 'Username sudah dipakai.' }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } }, // dibaca oleh trigger handle_new_user
  })
  if (error) return { error: error.message }

  // Kalau konfirmasi email masih aktif, belum ada sesi login
  if (!data.session) {
    return { error: 'Akun dibuat, tapi email perlu dikonfirmasi dulu sebelum masuk.' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Email atau password salah.' }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/')
}