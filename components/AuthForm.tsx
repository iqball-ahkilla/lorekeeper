'use client'

import { useActionState } from 'react'
import type { AuthState } from '@/app/actions/auth'

type Props = {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>
  mode: 'login' | 'signup'
}

const inputClass = 'mt-1 w-full rounded border border-gray-400 bg-transparent px-3 py-2'

export default function AuthForm({ action, mode }: Props) {
  const [state, formAction, pending] = useActionState(action, null)

  return (
    <form action={formAction} className="space-y-4">
      {mode === 'signup' && (
        <label className="block">
          <span className="text-sm">Username</span>
          <input name="username" required minLength={3} maxLength={20} className={inputClass} />
        </label>
      )}

      <label className="block">
        <span className="text-sm">Email</span>
        <input name="email" type="email" required className={inputClass} />
      </label>

      <label className="block">
        <span className="text-sm">Password</span>
        <input name="password" type="password" required minLength={8} className={inputClass} />
      </label>

      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Memproses...' : mode === 'signup' ? 'Daftar' : 'Masuk'}
      </button>
    </form>
  )
}