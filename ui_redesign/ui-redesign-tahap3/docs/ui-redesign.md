# Dokumentasi UI Redesign (tahap 1-3)

Redesign tampilan berdasarkan desain Google Stitch. Prinsip kerjanya: **hanya lapisan tampilan
yang diubah** (class Tailwind dan markup). Server Action, fungsi database, dan aturan RLS tidak
disentuh. Desain Stitch dipakai sebagai referensi, bukan ditempel mentah.

## Cara menjalankan tes

1. Terapkan patch tahap 1-2, lalu tahap 3, di branch `ui-redesign`.
2. `npm run dev`, buka halaman yang disebut di bawah.
3. `npm run build` harus lolos sebelum merge ke `main`.

Tidak ada dependensi npm baru.

## Sistem desain (tahap 1)

| Hal | Isi |
|---|---|
| Palet | Token di `app/globals.css`: `ink` (latar), `deep`, `surface`, `surface-2`, `line`, `gold`, `gold-dim`, `parch`, `fg`, `muted`, `faint`, `sky`, `rose` |
| Font | Inter (isi) dan Playfair Display (judul), lewat `next/font/google` di `app/layout.tsx` |
| Kelas bersama | `.page`, `.eyebrow`, `.card`, `.chip`, `.btn-gold`, `.btn-ghost`, `.btn-danger`, `.field`, `.link-gold`, `.hero-bg` |
| Komponen baru | `Footer`, `Icons` (SVG buatan sendiri), `Breadcrumb` |
| Pembantu | `lib/text.ts`: `plainText`, `excerpt`, `readMinutes` (menit baca) |

Mengubah warna seluruh situs cukup dilakukan di blok `@theme` pada `globals.css`.

## Perubahan per halaman

### Semua halaman: navbar dan footer
- Navbar: logo, tautan Beranda / Leaderboard / Cari, dan menu pengguna (dropdown). Tautan
  Profil saya, Catatan saya, serta Panel review, Kelola konten, dan Riwayat aktivitas (khusus
  lorekeeper) kini berada di dropdown, bukan lagi baris tautan. Tombol Keluar ada di dropdown.
- Footer baru.

### Beranda `/`
- Baru: hero + pencarian, empat statistik (Wilayah, Entri lore, Catatan disetujui, Anggota),
  arsip wilayah/topik dengan tab Semua/Wilayah/Topik (`?jenis=`), Entri Terbaru, Catatan
  Komunitas Terbaru, ajakan mendaftar.
- Data semuanya dari tabel yang sudah ada. "Entri Terbaru" memakai `first_published_at`.

### Wilayah `/lore/[region]`
- Kartu sub-bagian (nama, nama alternatif kecil, jumlah entri terbit), menggantikan daftar tautan.
- Breadcrumb menggantikan tautan "← Beranda".

### Sub-bagian `/lore/[region]/[subsection]`
- Kartu entri dengan cuplikan paragraf pertama dan perkiraan menit baca.
- Breadcrumb menampilkan nama alternatif sub-bagian.

### Entri `/lore/[region]/[subsection]/[entry]`
- Judul serif besar, lencana "Lore resmi", menit baca, status.
- Daftar isi bernomor (01, 02, ...) di sisi kanan (menempel) pada layar lebar, di atas artikel
  pada layar kecil. Heading level 2 diberi nomor "§ 1.", "§ 2.", dst.
- Gambar dan video dibungkus kartu dengan keterangan di bawahnya.
- Kutipan (blok `quote`) berbingkai garis emas.
- Catatan komunitas yang disetujui: kartu dengan garis emas, label "Catatan komunitas ·
  disetujui", dan tombol "Spekulasi komunitas [?]" (tap untuk membuka tooltip, sama seperti
  sebelumnya).
- Bagian Komunitas: tab filter Semua / Catatan / Komentar dengan jumlahnya (`?tampil=`),
  penjelasan alur catatan (4 langkah, bisa dibuka-tutup), kartu per komentar/catatan, kotak
  bukti, tombol dukungan, dan banner untuk tamu yang belum login.

## Elemen desain Stitch yang sengaja tidak dipakai

Alasannya: tidak ada datanya, atau bertentangan dengan aturan yang sudah diputuskan.

**Beranda**
- Tome Filter di hero (kategori seperti "Archon War" tidak ada di database).
- Subjudul tiap wilayah, penomoran "Vol. I-IV".
- Confidence Score, jumlah "counter-arguments" versi Stitch, tag topik pada kartu teori.
- Tab "Active Expeditions / Sub-Surface Deeps / Pre-Sundering" (diganti Wilayah/Topik).
- Tiga kolom "Archival Taxonomy" (aturan karangan yang bertentangan dengan aturan nyata).
- Pintasan keyboard ⌘K di kotak cari.

**Halaman entri**
- "Folio Archive Ref", "Verified V4.6", "Official Archival Compendium • Pre-Cataclysm Era".
- Kartu "Archival Taxonomy" (klasifikasi, sumber utama, kurator).
- Tombol Cite in Manuscript, Copy Canonical URI, Report Translation Variance, Bookmark,
  Share Citation.
- "Plate Ref", penomoran "Fig 1.1", durasi video, jumlah view dan nama kanal.
- Tombol downvote, vote pada komentar biasa, pangkat ("High Scribe Rank VIII", dst.),
  tab "Write a Comment / Submit a Lore Note", Save Draft, toolbar B/I, "Markdown supported".
- Paginasi komentar ("Showing 2 of 18") dan pilihan urutan "Most Discussed".
- Dua kartu statistik di halaman diskusi.

**Alasan khusus**: Stitch menampilkan diskusi sebagai halaman terpisah; di sini tetap menjadi
bagian di bawah entri, seperti sebelumnya.

## Pemeriksaan: apakah ada fitur yang hilang?

Tidak ada fitur yang dihapus. Perubahan pada kode data hanya **penambahan** kolom/relasi yang
dibaca, dan satu parameter URL baru:

| Perubahan | Keterangan |
|---|---|
| Query wilayah | Tambah `kind` dan `lore_entries(status)` untuk label dan jumlah entri |
| Query sub-bagian | Tambah `content_blocks(body, block_type, sort_order)` untuk cuplikan |
| Query entri | Tambah `alt_name` sub-bagian untuk breadcrumb |
| `?tampil=catatan\|komentar` | Filter diskusi di sisi server |
| Prop `basePath`, `filter` | Prop baru di `CommentSection` |

Fitur yang tetap ada dan hanya berganti tampilan/letak:

| Fitur | Status |
|---|---|
| Pencarian (`/search`) | Ada (navbar dan hero beranda) |
| Daftar isi dari heading | Ada, kini bernomor |
| Catatan kuning inline + tooltip tap-to-toggle | Ada |
| Tautan `[[path\|teks]]` | Ada, berwarna emas |
| Gambar dan YouTube per paragraf | Ada |
| Komentar, balasan, edit/hapus komentar sendiri, hapus oleh lorekeeper | Ada |
| Ajukan catatan dengan bukti teks/file, edit dan tarik catatan sendiri | Ada |
| Upvote catatan (tidak untuk catatan sendiri) | Ada |
| Label "diedit" / "disunting lorekeeper", lencana status | Ada |
| Tautan "Edit teks (lorekeeper)" dan pratinjau draft untuk lorekeeper | Ada |
| Tautan Catatan saya, Panel, Kelola, Riwayat | Ada, pindah ke menu pengguna |

Teks yang berubah: label "Under review by lorekeeper" menjadi "Sedang direview lorekeeper",
"Lore Entry · paragraf n" menjadi "Catatan komunitas · paragraf n", dan awalan "Note komunitas:"
pada catatan kuning digantikan label di kepala kartu.

## Belum dikerjakan (tahap berikutnya)

Tahap 4: Catatan saya, profil, leaderboard, pencarian, login/daftar. Tahap 5-6: panel review
lorekeeper, editor, kelola konten, riwayat aktivitas. Halaman-halaman itu masih bergaya lama
(tetap berfungsi, hanya latarnya sudah gelap).
