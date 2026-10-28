import Link from 'next/link'
import AuthForm from '@/components/AuthForm'
import { signUp } from '@/app/actions/auth'

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <p className="eyebrow">Bergabung dengan komunitas</p>
        <h1 className="mb-2 mt-1 font-serif text-3xl font-semibold text-fg">Daftar</h1>
        <p className="mb-6 text-sm text-muted">
          Anggota dapat berkomentar dan mengajukan catatan komunitas dengan bukti.
        </p>
        <AuthForm action={signUp} mode="signup" />
        <p className="mt-6 text-sm text-muted">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-gold hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </main>
  )
}
