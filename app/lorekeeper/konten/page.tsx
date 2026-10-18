import { Suspense } from 'react'
import Link from 'next/link'
import { requireLorekeeper } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createRegion, createSubsection, createEntry } from '@/app/actions/structure'
import ActionForm from '@/components/ActionForm'
import ItemControls from '@/components/ItemControls'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'

type Entry = {
  id: string
  title: string
  slug: string
  status: ContentStatus
  first_published_at: string | null
}

type Sub = {
  id: string
  name: string
  alt_name: string | null
  slug: string
  status: ContentStatus
  sort_order: number
  first_published_at: string | null
  lore_entries: Entry[]
}

type Reg = {
  id: string
  name: string
  slug: string
  description: string | null
  kind: 'region' | 'topic'
  status: ContentStatus
  sort_order: number
  first_published_at: string | null
  subsections: Sub[]
}

const inputClass =
  'mt-1 w-full rounded border border-gray-400 bg-transparent px-3 py-1.5 text-sm'

async function KontenContent() {
  await requireLorekeeper()
  const supabase = await createClient()

  const { data } = await supabase
    .from('regions')
    .select(
      'id, name, slug, description, kind, status, sort_order, first_published_at, subsections(id, name, alt_name, slug, status, sort_order, first_published_at, lore_entries(id, title, slug, status, first_published_at))'
    )
    .order('sort_order', { ascending: true })
    .order('sort_order', { ascending: true, referencedTable: 'subsections' })

  const regions = (data ?? []) as unknown as Reg[]
  const groups = [
    { title: 'Wilayah', items: regions.filter((r) => r.kind === 'region') },
    { title: 'Topik', items: regions.filter((r) => r.kind === 'topic') },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold">Kelola konten</h1>
      <p className="mt-1 text-sm opacity-70">
        Konten baru selalu dimulai sebagai draft. Hanya item yang terbit (dan induknya
        terbit) yang terlihat publik.
      </p>

      <details className="mt-6 rounded border border-gray-400 p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          + Tambah wilayah / topik
        </summary>
        <ActionForm
          action={createRegion}
          submitLabel="Buat draft"
          resetOnSuccess
          className="mt-3 space-y-2"
        >
          <label className="block text-xs">
            Nama
            <input name="name" required className={inputClass} />
          </label>
          <label className="block text-xs">
            Jenis
            <select name="kind" defaultValue="region" className={inputClass}>
              <option value="region">Wilayah</option>
              <option value="topic">Topik</option>
            </select>
          </label>
          <label className="block text-xs">
            Deskripsi (opsional)
            <textarea name="description" rows={2} className={inputClass} />
          </label>
          <label className="block text-xs">
            Slug (opsional, otomatis dari nama)
            <input name="slug" className={inputClass} />
          </label>
        </ActionForm>
      </details>

      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <section key={g.title} className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase opacity-60">{g.title}</h2>

            <div className="space-y-3">
              {g.items.map((r) => (
                <details key={r.id} className="rounded border border-gray-400 p-4">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <StatusBadge status={r.status} />
                    <span className="text-xs opacity-50">/{r.slug}</span>
                  </summary>

                  <ItemControls
                    type="region"
                    canMove
                    item={{
                      id: r.id,
                      name: r.name,
                      slug: r.slug,
                      status: r.status,
                      firstPublishedAt: r.first_published_at,
                      description: r.description,
                      kind: r.kind,
                    }}
                  />

                  <details className="mt-4 rounded border border-gray-400 p-3">
                    <summary className="cursor-pointer text-xs font-semibold">
                      + Tambah sub-section
                    </summary>
                    <ActionForm
                      action={createSubsection}
                      submitLabel="Buat draft"
                      resetOnSuccess
                      className="mt-2 space-y-2"
                    >
                      <input type="hidden" name="regionId" value={r.id} />
                      <label className="block text-xs">
                        Nama
                        <input name="name" required className={inputClass} />
                      </label>
                      <label className="block text-xs">
                        Nama alternatif (opsional)
                        <input name="alt_name" className={inputClass} />
                      </label>
                      <label className="block text-xs">
                        Slug (opsional)
                        <input name="slug" className={inputClass} />
                      </label>
                    </ActionForm>
                  </details>

                  <div className="mt-4 space-y-3">
                    {r.subsections.map((s) => {
                      const entries = [...s.lore_entries].sort((a, b) =>
                        a.title.localeCompare(b.title)
                      )
                      return (
                        <details key={s.id} className="rounded border border-gray-400 p-3">
                          <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                            <span className="font-medium">{s.name}</span>
                            {s.alt_name && (
                              <span className="text-xs opacity-50">{s.alt_name}</span>
                            )}
                            <StatusBadge status={s.status} />
                            <span className="text-xs opacity-50">/{s.slug}</span>
                          </summary>

                          <ItemControls
                            type="subsection"
                            canMove
                            item={{
                              id: s.id,
                              name: s.name,
                              slug: s.slug,
                              status: s.status,
                              firstPublishedAt: s.first_published_at,
                              altName: s.alt_name,
                            }}
                          />

                          <details className="mt-3 rounded border border-gray-400 p-3">
                            <summary className="cursor-pointer text-xs font-semibold">
                              + Tambah entry
                            </summary>
                            <ActionForm
                              action={createEntry}
                              submitLabel="Buat draft"
                              resetOnSuccess
                              className="mt-2 space-y-2"
                            >
                              <input type="hidden" name="subsectionId" value={s.id} />
                              <label className="block text-xs">
                                Judul
                                <input name="title" required className={inputClass} />
                              </label>
                              <label className="block text-xs">
                                Slug (opsional)
                                <input name="slug" className={inputClass} />
                              </label>
                            </ActionForm>
                          </details>

                          <ul className="mt-3 space-y-3">
                            {entries.map((e) => (
                              <li key={e.id} className="rounded border border-gray-400 p-3">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <span className="font-medium">{e.title}</span>
                                  <StatusBadge status={e.status} />
                                  <span className="text-xs opacity-50">/{e.slug}</span>
                                  <Link
                                    href={`/lore/${r.slug}/${s.slug}/${e.slug}`}
                                    className="text-xs underline"
                                  >
                                    Buka
                                  </Link>
                                  <Link
                                    href={`/lorekeeper/edit/${r.slug}/${s.slug}/${e.slug}`}
                                    className="text-xs underline"
                                  >
                                    Edit isi
                                  </Link>
                                </div>
                                <ItemControls
                                  type="entry"
                                  canMove={false}
                                  item={{
                                    id: e.id,
                                    name: e.title,
                                    slug: e.slug,
                                    status: e.status,
                                    firstPublishedAt: e.first_published_at,
                                  }}
                                />
                              </li>
                            ))}
                            {entries.length === 0 && (
                              <li className="text-xs opacity-60">Belum ada entry.</li>
                            )}
                          </ul>
                        </details>
                      )
                    })}
                    {r.subsections.length === 0 && (
                      <p className="text-xs opacity-60">Belum ada sub-section.</p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )
      )}
    </>
  )
}

export default function KontenPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <p className="mb-4 text-sm">
        <Link href="/lorekeeper" className="underline">← Panel lorekeeper</Link>
      </p>
      <Suspense fallback={<p>Memuat...</p>}>
        <KontenContent />
      </Suspense>
    </main>
  )
}