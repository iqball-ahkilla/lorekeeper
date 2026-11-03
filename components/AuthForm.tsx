'use client'

import { useActionState } from 'react'
import type { AuthState } from '@/app/actions/auth'

type Props = {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>
  mode: 'login' | 'signup'
}

const inputClass = 'field mt-1'

export default function AuthForm({ action, mode }: Props) {
  const [state, formAction, pending] = useActionState(action, null)

  return (
    <form action={formAction} className="space-y-4">
      {mode === 'signup' && (
        <label className="block">
          <span className="text-sm text-muted">Username</span>
          <input name="username" required minLength={3} maxLength={20} className={inputClass} />
        </label>
      )}

      <label className="block">
        <span className="text-sm text-muted">Email</span>
        <input name="email" type="email" required className={inputClass} />
      </label>

      <label className="block">
        <span className="text-sm text-muted">Password</span>
        <input name="password" type="password" required minLength={8} className={inputClass} />
      </label>

      {state?.error && <p className="text-sm text-rose">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="btn-gold w-full py-2.5 disabled:opacity-50"
      >
        {pending ? 'Memproses...' : mode === 'signup' ? 'Daftar' : 'Masuk'}
      </button>
    </form>
  )
}