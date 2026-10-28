import { Suspense } from 'react'
import Link from 'next/link'
import { requireLorekeeper } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createRegion, createSubsection, createEntry } from '@/app/actions/structure'
import ActionForm from '@/components/ActionForm'
import ItemControls from '@/components/ItemControls'
import StatusBadge, { type ContentStatus } from '@/components/StatusBadge'
import Breadcrumb from '@/components/Breadcrumb'

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

const inputClass = 'field mt-1 py-1.5'

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
      <Breadcrumb
        items={[
          { label: 'Beranda', href: '/' },
          { label: 'Panel review', href: '/lorekeeper' },
          { label: 'Kelola konten' },
        ]}
      />

      <header className="mt-6 max-w-2xl">
        <p className="eyebrow">Panel lorekeeper</p>
        <h1 className="mt-1 font-serif text-4xl font-semibold text-fg">Kelola Konten</h1>
        <p className="mt-2 text-sm text-muted">
          Konten baru selalu dimulai sebagai draft. Hanya item yang terbit (dan induknya
          terbit) yang terlihat publik.
        </p>
      </header>

      <details className="card mt-8 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-gold">
          + Tambah wilayah / topik
        </summary>
        <ActionForm
          action={createRegion}
          submitLabel="Buat draft"
          resetOnSuccess
          className="mt-3 space-y-2"
        >
          <label className="block text-xs text-muted">
            Nama
            <input name="name" required className={inputClass} />
          </label>
          <label className="block text-xs text-muted">
            Jenis
            <select name="kind" defaultValue="region" className={inputClass}>
              <option value="region">Wilayah</option>
              <option value="topic">Topik</option>
            </select>
          </label>
          <label className="block text-xs text-muted">
            Deskripsi (opsional)
            <textarea name="description" rows={2} className={inputClass} />
          </label>
          <label className="block text-xs text-muted">
            Slug (opsional, otomatis dari nama)
            <input name="slug" className={inputClass} />
          </label>
        </ActionForm>
      </details>

      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <section key={g.title} className="mt-10">
            <h2 className="eyebrow mb-3">{g.title}</h2>

            <div className="space-y-3">
              {g.items.map((r) => (
                <details key={r.id} className="card p-4">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-serif text-lg font-semibold text-fg">{r.name}</span>
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-faint">/{r.slug}</span>
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

                  <details className="mt-4 rounded-md border border-line bg-deep/40 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-gold">
                      + Tambah sub-bagian
                    </summary>
                    <ActionForm
                      action={createSubsection}
                      submitLabel="Buat draft"
                      resetOnSuccess
                      className="mt-2 space-y-2"
                    >
                      <input type="hidden" name="regionId" value={r.id} />
                      <label className="block text-xs text-muted">
                        Nama
                        <input name="name" required className={inputClass} />
                      </label>
                      <label className="block text-xs text-muted">
                        Nama alternatif (opsional)
                        <input name="alt_name" className={inputClass} />
                      </label>
                      <label className="block text-xs text-muted">
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
                        <details key={s.id} className="rounded-md border border-line bg-deep/30 p-3">
                          <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                            <span className="font-medium text-fg">{s.name}</span>
                            {s.alt_name && (
                              <span className="text-xs text-faint">{s.alt_name}</span>
                            )}
                            <StatusBadge status={s.status} />
                            <span className="text-xs text-faint">/{s.slug}</span>
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

                          <details className="mt-3 rounded-md border border-line p-3">
                            <summary className="cursor-pointer text-xs font-semibold text-gold">
                              + Tambah entri
                            </summary>
                            <ActionForm
                              action={createEntry}
                              submitLabel="Buat draft"
                              resetOnSuccess
                              className="mt-2 space-y-2"
                            >
                              <input type="hidden" name="subsectionId" value={s.id} />
                              <label className="block text-xs text-muted">
                                Judul
                                <input name="title" required className={inputClass} />
                              </label>
                              <label className="block text-xs text-muted">
                                Slug (opsional)
                                <input name="slug" className={inputClass} />
                              </label>
                            </ActionForm>
                          </details>

                          <ul className="mt-3 space-y-3">
                            {entries.map((e) => (
                              <li key={e.id} className="rounded-md border border-line p-3">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <span className="font-medium text-fg">{e.title}</span>
                                  <StatusBadge status={e.status} />
                                  <span className="text-xs text-faint">/{e.slug}</span>
                                  <Link
                                    href={`/lore/${r.slug}/${s.slug}/${e.slug}`}
                                    className="text-xs font-medium text-gold hover:underline"
                                  >
                                    Buka
                                  </Link>
                                  <Link
                                    href={`/lorekeeper/edit/${r.slug}/${s.slug}/${e.slug}`}
                                    className="text-xs font-medium text-gold hover:underline"
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
                              <li className="text-xs text-faint">Belum ada entri.</li>
                            )}
                          </ul>
                        </details>
                      )
                    })}
                    {r.subsections.length === 0 && (
                      <p className="text-xs text-faint">Belum ada sub-bagian.</p>
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
    <main className="page max-w-4xl flex-1 py-8 sm:py-10">
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <KontenContent />
      </Suspense>
    </main>
  )
}