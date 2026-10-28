'use client'

import { useActionState, useEffect, useRef, startTransition } from 'react'
import type { ReactNode } from 'react'
import type { ActionState } from '@/app/actions/structure'

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  submitLabel: string
  resetOnSuccess?: boolean
  className?: string
  children: ReactNode
  buttonClassName?: string
}

export default function ActionForm({
  action,
  submitLabel,
  resetOnSuccess = false,
  className,
  buttonClassName,
  children,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset()
  }, [state, resetOnSuccess])

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        startTransition(() => formAction(formData))
      }}
    >
      {children}
      {state && (
        <p className={`text-sm ${state.ok ? 'text-emerald-300' : 'text-rose'}`}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={buttonClassName ?? 'btn-gold py-1.5 disabled:opacity-50'}>
        {pending ? 'Menyimpan...' : submitLabel}
      </button>
    </form>
  )
}