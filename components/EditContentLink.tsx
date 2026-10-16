import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'

export default async function EditContentLink({ href }: { href: string }) {
  const user = await getCurrentUser()
  if (user?.role !== 'lorekeeper') return null

  return (
    <Link href={href} className="text-sm underline">
      Edit teks (lorekeeper)
    </Link>
  )
}