import Link from 'next/link'
import AuthForm from '@/components/AuthForm'
import { signIn } from '@/app/actions/auth'

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-bold">Masuk</h1>
      <AuthForm action={signIn} mode="login" />
      <p className="mt-4 text-sm">
        Belum punya akun? <Link href="/signup" className="underline">Daftar</Link>
      </p>
    </main>
  )
}