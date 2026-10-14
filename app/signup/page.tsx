import Link from 'next/link'
import AuthForm from '@/components/AuthForm'
import { signUp } from '@/app/actions/auth'

export default function SignupPage() {
  return (
    <main className="mx-auto w-full max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-bold">Daftar</h1>
      <AuthForm action={signUp} mode="signup" />
      <p className="mt-4 text-sm">
        Sudah punya akun? <Link href="/login" className="underline">Masuk</Link>
      </p>
    </main>
  )
}