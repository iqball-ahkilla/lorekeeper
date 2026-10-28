# Dokumentasi UI Redesign (tahap 1-6, selesai)

Redesign tampilan berdasarkan desain Google Stitch. Prinsip kerjanya: **hanya lapisan tampilan
yang diubah** (class Tailwind dan markup). Server Action, fungsi database, dan aturan RLS tidak
disentuh. Desain Stitch dipakai sebagai referensi, bukan ditempel mentah.

## Cara menjalankan tes

1. Terapkan patch tahap 1-2, lalu tahap 3, 4, 5, dan 6, di branch `ui-redesign`.
2. `npm run dev`, buka halaman yang disebut di bawah.
3. `npm run build` harus lolos sebelum merge ke `main`.

Tidak ada dependensi npm baru.

## Sistem desain (tahap 1)

| Hal | Isi |
|---|---|
| Palet | Token di `app/globals.css`: `ink` (latar), `deep`, `surface`, `surface-2`, `line`, `gold`, `gold-dim`, `parch`, `fg`, `muted`, `faint`, `sky`, `rose` |
| Font | Inter (isi) dan Playfair Display (judul), lewat `next/font/google` di `app/layout.tsx` |
| Kelas bersama | `.page`, `.eyebrow`, `.card`, `.chip`, `.btn-gold`, `.btn-ghost`, `.btn-danger`, `.field`, `.link-gold`, `.hero-bg` |
| Komponen baru | `Footer`, `Icons` (SVG buatan sendiri), `Breadcrumb`, `Avatar` (huruf pertama username) |
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

### Catatan saya `/catatan-saya`
- Header serif emas, tombol "Cari lore untuk dicatat", kartu profil (username, role) dengan empat
  angka: Diajukan, Disetujui, Dalam review, Ditolak.
- Tab filter status (`?status=submitted|under_review|approved|rejected`) dengan jumlahnya.
- Kartu catatan: judul entri, paragraf terkait, isi, bukti, lampiran, jumlah dukungan. Catatan
  ditolak diberi garis atas merah dan kotak "Alasan penolakan (hanya terlihat olehmu)".
- Catatan yang ditolak menampilkan tautan ke entri untuk **mengajukan catatan baru**, karena
  aturan: catatan ditolak tidak bisa diedit.

### Profil publik `/profile/[id]`
- Kartu profil dengan avatar huruf, username, lencana lorekeeper, tanggal bergabung, jumlah
  catatan disetujui. Daftar catatan disetujui sebagai kartu (catatan memakai gaya kuning-italic
  seperti di halaman entri).

### Leaderboard `/leaderboard`
- Baris berupa kartu yang bisa diklik ke profil; peringkat 1-3 berwarna emas. Skor sama tetap
  berbagi peringkat.

### Pencarian `/search`
- Kotak cari bergaya baru, jumlah hasil, dan hasil dikelompokkan jadi kartu: Wilayah & topik,
  Sub-bagian, Entri lore. Label "Region" dan "Sub-section" diganti "Wilayah" dan "Sub-bagian".

### Masuk dan Daftar `/login`, `/signup`
- Kartu di tengah halaman dengan judul serif, kolom isian dan tombol bergaya baru. Formulir dan
  Server Action yang sama.

### Panel review lorekeeper `/lorekeeper`
- Tata letak dua kolom: **antrean di kiri, pemeriksaan catatan di kanan**. Di HP, mengetuk
  catatan langsung menggulir ke bagian pemeriksaan.
- Antrean: tab Semua / Menunggu / Direview / Disetujui (`?tab=`), pencarian judul/penulis/isi
  (`?q=`), urutan Dukungan terbanyak atau Terbaru (`?urut=`), dan catatan terpilih (`?catatan=`).
  Catatan yang belum diputuskan selalu di atas yang sudah disetujui.
- Tiga angka ringkas: Menunggu review, Sedang direview, Tingkat persetujuan (disetujui dibagi
  disetujui + ditolak, dihitung dari data).
- Pemeriksaan: judul entri, paragraf terkait, penulis dan waktu, dukungan, isi catatan, bukti
  dan lampiran, penjelasan alur, serta **pemeriksaan tautan** (tiap `[[path|teks]]` dicek
  terhadap daftar tujuan, ditandai Valid atau Tujuan tidak ditemukan).
- Aksi tidak berubah: Mulai review, Setujui, Tolak (alasan wajib) atau Cabut persetujuan
  (untuk yang sudah disetujui), dan Edit teks catatan dengan popup `[[`. Semuanya memakai
  Server Action dan fungsi `review_note` yang sama.
- Popup autocomplete `[[` (`LinkTextarea`) kini memakai warna tema, tidak lagi bergantung pada
  mode terang/gelap perangkat.

### Editor lorekeeper `/lorekeeper/edit/[region]/[subsection]/[entry]`
- Dua kolom: **pohon struktur** di kiri (wilayah, sub-bagian, entri; entri yang sedang diedit
  disorot, dan bisa berpindah entri langsung) dan **blok** di kanan. Di HP pohon berada di atas.
- Header: breadcrumb, judul serif, status, tombol Lihat halaman, dan **Terbitkan** (hanya
  tampil untuk entri berstatus draft; memakai Server Action `changeStatus` yang sama dengan
  halaman Kelola konten).
- Kartu blok: nomor, jenis blok, jumlah media dan catatan aktif, tombol geser, kolom isi dengan
  popup `[[`, panel media (tambah, caption, geser, hapus), hapus blok, dan tambah blok.
- Aturan lama tetap: blok yang punya catatan aktif tidak bisa dihapus.

### Kelola konten `/lorekeeper/konten`
- Breadcrumb, header serif, kartu per wilayah/topik, sub-bagian, dan entri. Kontrol (Terbitkan,
  Arsipkan, Pulihkan, geser, Edit, Hapus permanen dengan ketik nama) hanya berganti gaya. Slug
  terkunci setelah pernah terbit, sama seperti sebelumnya.

### Riwayat aktivitas `/lorekeeper/riwayat`
- Filter (jenis aksi, pelaku) dalam kartu, daftar aktivitas sebagai kartu dengan waktu WIB,
  pelaku, aksi, tautan ke target, dan rincian. Paginasi "Lebih lama" tetap.

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

**Catatan saya**
- Tombol "Edit & Resubmit", tab "Drafts", tombol "Archive Submission" (tidak ada status draft,
  dan catatan ditolak tidak bisa diedit; diganti tautan ajukan catatan baru).
- "Affiliation", "Scribe ID", pangkat, "Desk ID", "Live Sync".
- Judul catatan (catatan tidak punya judul di database; yang tampil isi catatan).
- "Criteria Failed" dan "Canon Verification Level", nama reviewer, nomor "Ref #LN-xxxx",
  kolom tabel (diganti kartu supaya muat di HP), tiga kartu aturan di bawah halaman.
- Pagination (belum diperlukan).

**Panel review**
- "Assigned to you", "Station: DESK-04", "Switch Desk" (tidak ada penugasan ke reviewer),
  "Median latency" (diganti Tingkat persetujuan), "Synod approval", "Active Session".
- Teks "Unclaimed Note Workflow Prototype" dan tombol filter lanjutan (ikon saring).
- Nama lorekeeper yang sedang me-review di setiap baris (tidak disimpan).
- Tab "Approved & Indexed" memuat 20 catatan disetujui terbaru, sama seperti sebelumnya.

**Editor lorekeeper**
- "Schema: content_blocks v2.4", "All edits synchronized with Supabase", "Revisions (14)"
  (tidak ada riwayat versi isi; aksi tercatat di Riwayat aktivitas), tombol Discard.
- "Canonical Era Tag" dan bidang slug yang tampak bisa diedit (slug tetap dikunci).
- Tipe media karangan ("In-game Photogrammetry Plate"), tombol "Sync" dan metadata video
  (resolusi, kanal).
- Kolom **pratinjau langsung** beserta pilihan Desktop/Mobile: ditunda, karena blok disimpan per
  blok lewat Server Action. Pratinjau tetap bisa dilihat lewat tombol "Lihat halaman".
- Toolbar Markdown dan tulisan "Markdown supported" (teks tidak memakai Markdown).

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
| Query editor | Tambah satu query pohon struktur (wilayah, sub-bagian, entri) untuk sidebar |
| Query panel review | Tambah dua hitungan (`approved`, `rejected`) untuk Tingkat persetujuan |
| Query Catatan saya | Tambah `note_votes(user_id)` untuk jumlah dukungan |
| `?tampil=catatan\|komentar` | Filter diskusi di sisi server |
| `?status=...` di Catatan saya | Filter status di sisi server |
| `?tab`, `?q`, `?urut`, `?catatan` di panel review | Filter, pencarian, urutan, dan pilihan catatan di sisi server |
| Prop `basePath`, `filter` | Prop baru di `CommentSection` |

Fitur yang tetap ada dan hanya berganti tampilan/letak:

| Fitur | Status |
|---|---|
| Catatan saya: alasan penolakan privat, lampiran, status | Ada, ditambah filter status |
| Editor blok: tambah, ubah jenis, geser, hapus (dengan aturan catatan aktif), media | Ada, logika sama |
| Kelola konten: Draft/Terbit/Arsip, slug terkunci, geser, hapus permanen | Ada, logika sama |
| Riwayat aktivitas dengan filter dan paginasi | Ada |
| Review: Mulai Review, Setujui, Tolak + alasan wajib, Cabut persetujuan, edit teks + popup `[[` | Ada, logika sama |
| Antrean diurutkan dukungan terbanyak | Ada (default), ditambah urutan Terbaru |
| Profil publik dan leaderboard (peringkat sama untuk skor sama) | Ada |
| Login, daftar, keluar | Ada (Server Action tidak diubah) |
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

## Belum dikerjakan

Semua halaman yang ada sudah mendapat gaya baru. Sisa yang bisa dikerjakan bila waktu ada:
- Pratinjau langsung di editor (butuh komponen client baru).
- Gambar hero sendiri (taruh di `.hero-bg` pada `app/globals.css`).
- Paginasi komentar bila jumlahnya sudah banyak.
- Halaman 404 dan error bergaya tema.
