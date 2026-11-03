import Link from 'next/link'
import AuthForm from '@/components/AuthForm'
import { signIn } from '@/app/actions/auth'

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <p className="eyebrow">Selamat datang kembali</p>
        <h1 className="mb-6 mt-1 font-serif text-3xl font-semibold text-fg">Masuk</h1>
        <AuthForm action={signIn} mode="login" />
        <p className="mt-6 text-sm text-muted">
          Belum punya akun?{' '}
          <Link href="/signup" className="font-medium text-gold hover:underline">
            Daftar
          </Link>
        </p>
      </div>
    </main>
  )
}
