# Design: TaskPulse

Dokumen desain. Sumber keputusan visual untuk seluruh UI. Pendamping `plan.md` (tujuan) dan `architecture.md` (teknis).

## Arah desain (Design Read)

> **Reading this as:** app alat produktivitas personal (task & deadline tracker) untuk pelajar/pekerja Indonesia, gaya *calm editorial ledger* — seperti buku catatan akademik yang rapi, bukan dashboard teknologi.

**Dials: ENERGY 1 / RHYTHM 2 / MOTION 1**

- **ENERGY 1** — tenang. Aplikasi ini dipakai saat ada tekanan (deadline menumpuk). Desain tidak boleh menambah kecemasan. Satu fokus per layar, kontras lembut, tanpa dekorasi yang berteriak.
- **RHYTHM 2** — konsisten dengan beberapa jeda. Blok utama (daftar tugas) seragam; section header dan dashboard sengaja berbeda skala untuk memisahkan konteks.
- **MOTION 1** — hanya hover/active state. Tidak ada animasi berjalan terus. Transisi hanya saat buka/tutup form dan toggle, cepat (<200ms), halus. Tidak ada loop, pulse, parallax, atau scroll-reveal.

## Filosofi visual

Tiga pilar, semua berasal dari keputusan ENERGY 1 / RHYTHM 2:

1. **Kertas, bukan layar.** Background seperti halaman buku catatan (off-white hangat), kartu tugas seperti kartu indeks yang diletakkan di atasnya. Ini bukan dashboard SaaS yang "mengambang".
2. **Aksen tunggal, dipakai hemat.** Satu warna aksen (bata hangat) hanya untuk tombol utama, fokus, dan penanda aktif. Sisanya netral hangat.
3. **Status lewat teks, bukan warna.** Setiap status (terlambat, hari ini, selesai) selalu berupa teks + satu warna pendukung kecil. Warna tidak pernah jadi satu-satunya penanda.

## Palet warna

### Terang (default)

| Token | Hex | Penggunaan |
|---|---|---|
| `paper` | `#F5F3EE` | background halaman |
| `raised` | `#FFFDF8` | kartu tugas, form, sheet |
| `sunken` | `#ECE9E0` | input, area yang "masuk" |
| `ink` | `#1C1B18` | teks utama |
| `ink-soft` | `#55524A` | teks sekunder (tanggal, deskripsi) |
| `ink-faint` | `#6B675C` | teks tersier/placeholder |
| `rule` | `#DAD5C7` | garis pemisah, border tipis |
| `accent` | `#9A3B1B` | tombol utama, fokus, link aktif |
| `overdue` | `#A32017` | status terlambat |
| `today` | `#8A5A00` | status hari ini |
| `done` | `#4F6B4A` | status selesai |

**Kontras (sudah diverifikasi, semua ≥ 4.5:1 untuk teks):**
- ink di paper: **15.8:1** (AAA)
- ink-soft di paper: **7.2:1** (AAA)
- ink-faint di paper: **5.2:1** (AA)
- accent di paper: **6.4:1** (AA)
- overdue di paper: **6.9:1** (AA)
- today di paper: **5.4:1** (AA)
- done di paper: **5.5:1** (AA)
- putih di accent: **6.9:1** (AA)

### Gelap (toggle)

| Token | Hex | Penggunaan |
|---|---|---|
| `night` | `#171613` | background |
| `night-raised` | `#201F1A` | kartu/form |
| `night-ink` | `#F0EDE3` | teks utama |
| `night-ink-soft` | `#B5B0A2` | teks sekunder |
| `night-rule` | `#34322B` | garis/border |
| `night-accent` | `#E0764B` | aksen |
| `night-overdue` | `#F0857A` | terlambat |
| `night-today` | `#E0AE5A` | hari ini |
| `night-done` | `#8FBF87` | selesai |

Kontras gelap juga semua ≥ 4.5:1 (diverifikasi).

> **Catatan:** ini **bukan** aksen default AI (bukan biru-ungu gradient, bukan neon, bukan glassmorphism). Warna diambil dari dunia kertas/kertas catatan, sengaja netral-hangat. Aksen bata tunggal — satu-satunya warna yang "berbicara" selain status.

## Tipografi

Satu keluarga, dua register. Font **system stack** (tanpa webfont → cepat, offline, tanpa biaya hosting):

```
--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
```

| Level | Ukuran (mobile) | Ukuran (desktop) | Berat |
|---|---|---|---|
| Display (judul halaman) | 1.75rem | 2rem | 700 |
| H2 (section) | 1.25rem | 1.4rem | 600 |
| H3 (kartu judul) | 1rem | 1.05rem | 600 |
| Body | 0.95rem | 1rem | 400 |
| Small (tanggal, meta) | 0.8rem | 0.85rem | 400 |
| Micro (badge, label) | 0.7rem | 0.72rem | 600, uppercase, letter-spacing |

- **Line-height:** body 1.5, judul 1.2.
- **Angka:** tabular (`font-variant-numeric: tabular-nums`) untuk tanggal & countdown agar tidak "melompat".
- **Tanggal & deadline:** format Indonesia (`Sen, 3 Nov`), pakai `date-fns` locale `id`.

## Spacing & radius

Skala 4px. Jarak antar elemen dalam kartu 8–12px; antar kartu 12–16px; antar section 32–48px.

| Radius | Nilai | Dipakai |
|---|---|---|
| `r-sm` | 6px | badge, chip, input kecil |
| `r-md` | 10px | kartu tugas, form, sheet |
| `r-lg` | 14px | tombol utama |

**Aturan radius:** tidak ada pill. Semua sudut seragam kecil-sedang (6–14px). Ini kunci menghindari "everything pill" slop. Radius hanya pembeda level, bukan dekorasi.

## Bayangan (elevation)

- Kartu tugas: **flat** (hanya border tipis 1px `rule`). Tidak mengambang.
- Form/sheet (modal): **satu** bayangan lembut `0 4px 24px rgba(28,27,24,0.10)` — ini satu-satunya elemen yang "terangkat" di atas kertas.
- Tombol utama: tidak ada bayangan; kontras warna sudah cukup.

**Dosis bayangan:** maksimum 1 elemen terangkat per layar (sheet). Sisanya flat. Ini mengikuti R-12.

## Grid & layout

### Mobile (<768px)

- Satu kolom. Padding halaman 16px.
- **Bottom navigation** (5 item): Beranda, Tugas, Kalender, Tambah (+), Pengaturan. Tinggi 56px + safe-area inset. Konten diberi `padding-bottom` 72px agar tidak tertutup bottom nav.
- Tombol Tambah (+) di bottom nav: tombol aksen bulat, 56px, satu-satunya elemen aksen penuh.

### Tablet/Desktop (≥768px)

- Container max-width **760px**, centered. Ini aplikasi personal — tidak perlu lebar penuh.
- Mulai lebar 1024px, navigasi pindah ke sidebar kiri 200px. Pada tablet, bottom nav tetap digunakan.

### Breakpoint

- **<768px:** mobile (bottom nav, satu kolom).
- **768–1024px:** tablet (bottom nav tetap, konten max 640px).
- **≥1024px:** desktop (sidebar kiri 200px, konten 760px).

Breakpoint dipilih berdasarkan di mana konten berhenti nyaman dibaca, bukan mengikuti daftar perangkat (R-03).

## Komponen kunci

### TaskCard

Kartu tugas, daftar vertikal. Struktur per kartu:

```
[checkbox selesai]  [judul (1 line, ellipsis)]         [badge status]
                    [meta: kategori · tanggal · sisa hari]
```

- Checkbox: lingkaran 22px, border `ink-faint`. Saat selesai → terisi `done`, coretan teks.
- Badge status: teks pendek + dot kecil warna status. **Selalu ada teks** (bukan cuma dot).
- Tap area seluruh kartu → buka detail. Checkbox & tombol aksi punya hit area sendiri (≥44px) — tidak tumpang tindih dengan tap kartu.

### Status & bucket

| Bucket | Badge | Warna |
|---|---|---|
| Terlambat | "Terlambat" | `overdue` |
| Hari ini | "Hari ini" | `today` |
| Besok | "Besok" | `ink-soft` (netral) |
| Minggu ini | "Hari Rabu" / tanggal | `ink-soft` |
| Nanti | tanggal | `ink-soft` |
| Selesai | "Selesai" | `done` |

Warna status hanya 3 yang "berbicara": overdue, today, done. Sisanya netral. Aksen `accent` tidak dipakai untuk status sama sekali — itu hanya untuk aksi utama & fokus.

### Empty states (wajib, R-27)

| Konteks | Pesan | Aksi |
|---|---|---|
| Tidak ada tugas sama sekali | "Belum ada tugas. Tambahkan tugas pertamamu." | Tombol "+ Tambah Tugas" |
| Filter kosong | "Tidak ada tugas yang cocok dengan filter ini." | Tombol "Reset Filter" |
| Kalender kosong | "Tidak ada tugas di bulan ini." | Tombol "Lihat Semua" |

Tidak ada ilustrasi dekoratif, tidak ada spinner abu-abu tanpa keterangan. Setiap empty state menyebut penyebab + satu aksi jelas.

## Ikon & simbol

- **Icon.astro:** satu set simbol inline (stroke 1.5px, 20×20px, `currentColor`). Set: `home`, `list`, `calendar`, `plus`, `settings`, `check`, `trash`, `edit`, `bell`, `chevron-left`, `chevron-right`, `close`, `filter`, `export`, `import`.
- Tidak ada emoji sebagai ikon atau status (R-04). Tidak ada library ikon besar — 15 simbol cukup untuk seluruh app.

## Motion (MOTION 1)

| Interaksi | Perilaku | Durasi |
|---|---|---|
| Tombol/checkbox hover | background shift halus | 120ms |
| Tombol active | sedikit press (`scale 0.98`) | 100ms |
| Sheet buka/tutup | fade + slide-up 8px | 180ms ease-out |
| Theme toggle | color transition | 150ms |
| Checkbox selesai | coretan teks | 200ms |

**Tidak ada:** pulse, loop, parallax, scroll-reveal, shimmer, skeleton berkedip. Motion hanya merespons interaksi user. (Loading state: teks "Memuat…", bukan spinner loop.)

## Aksesibilitas (R-03, R-34, C-4)

- Semua kontras teks ≥ 4.5:1 (diverifikasi di atas).
- Tap target ≥ 44×44px; jarak antar target ≥ 8px.
- Keyboard: semua interaksi bisa via Tab + Enter/Space. Fokus terlihat (`outline: 2px accent`, offset 2px).
- `prefers-reduced-motion`: matikan semua transisi non-esensial.
- Status warna selalu disertai teks (bukan dot saja).
- Label form selalu eksplisit (`<label>`), placeholder tidak menggantikan label.

## Icon PWA

Icon 512px: latar `paper` solid, glyph "✓" aksen besar di tengah. Maskable: padding 25% agar tidak terpotong. Tidak ada gradient, tidak ada glow.

- `/icons/icon-192.png`
- `/icons/icon-512.png`
- `/icons/icon-maskable-512.png`

## Keputusan yang sengaja dihindari (dan alasannya)

| Yang dihindari | Alasan |
|---|---|
| Gradient biru-ungu / purple-black | Tell paling kuat dari AI slop (R-01) |
| Glassmorphism di navbar/card | Blur meratakan hierarki; cap maks 1-2 elemen (R-10) |
| Pill radius di semua elemen | Menghapus bahasa visual "ini input, ini card" (R-11) |
| Bento grid | Konten (daftar tugas) tidak punya elemen beda ukuran (R-05) |
| Dark mode default tanpa toggle | Tidak ada alasan brand; dibangun toggle (R-21) |
| Aksen di mana-mana | Aksen harus hanya di momen kunci (one deliberate accent) |
| Emoji sebagai status/ikon | R-04 |
| Filler data (John Doe, dll.) | R-23, R-38 — form kosong = kosong, bukan data palsu |
| "Trusted by" / logo bar | Tidak relevan untuk app personal; fabricasi (R-18) |
| Spinner tanpa teks | Loading harus menyebut apa yang dimuat (R-27) |

## Design tokens (ringkasan untuk implementasi)

CSS custom properties di `global.css` (Tailwind `@theme`):

```css
@import "tailwindcss";

@theme {
  --color-paper: #F5F3EE;
  --color-raised: #FFFDF8;
  --color-sunken: #ECE9E0;
  --color-ink: #1C1B18;
  --color-ink-soft: #55524A;
  --color-ink-faint: #6B675C;
  --color-rule: #DAD5C7;
  --color-accent: #9A3B1B;
  --color-overdue: #A32017;
  --color-today: #8A5A00;
  --color-done: #4F6B4A;

  --color-night: #171613;
  --color-night-raised: #201F1A;
  --color-night-ink: #F0EDE3;
  --color-night-ink-soft: #B5B0A2;
  --color-night-rule: #34322B;
  --color-night-accent: #E0764B;
  --color-night-overdue: #F0857A;
  --color-night-today: #E0AE5A;
  --color-night-done: #8FBF87;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
}
```

> Token gelap mencakup teks dan status utama. Token `night-sunken` dapat ditambahkan saat implementasi untuk field input jika perlu.

## Checklist desain (antislop UI)

- [ ] Palet berasal dari arah desain dokumen ini, bukan gradient default
- [ ] Aksen hanya di momen kunci (tombol utama, fokus), tidak menyebar
- [ ] Tidak ada emoji di heading/bullet/button
- [ ] Komposisi section bervariasi sesuai RHYTHM (bukan satu template diulang)
- [ ] Tidak ada bento grid, fake terminal, three-pricing, color-stripe tanpa makna
- [ ] Tidak ada pill badge kosong di atas H1
- [ ] Setiap nav/elemen punya tujuan nyata, tidak ada dead control
- [ ] Motion sesuai MOTION 1, tanpa loop tak berujung
- [ ] Glass/glow/shadow/radius sesuai dose cap, bukan default
- [ ] Setiap dot/light menandai state nyata, tanpa glow dekoratif
- [ ] Layout dibangun dari keputusan user di layar itu (bukan sidebar+stat+chart+table)
- [ ] Setiap angka/entry nyata atau placeholder berlabel, tanpa metrik karangan
- [ ] Field kosong = kosong / placeholder jujur, tanpa John Doe
- [ ] Empty/loading/error state menyebut penyebab + aksi
- [ ] Layout bertahan di semua breakpoint, theme, state; lolos keyboard-only
- [ ] Tap target ≥ 44×44px, jarak antar target cukup
- [ ] Tidak ada horizontal overflow / clipping di mobile
- [ ] Bottom nav tidak menutupi konten, hormati safe area
- [ ] Layout diverifikasi di breakpoint mobile
