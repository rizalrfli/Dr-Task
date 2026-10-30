# Plan: TaskPulse — Pengingat Tugas & Deadline

## Ringkasan

Aplikasi web (PWA installable) untuk mengingat tugas dan deadline. Offline-first dengan IndexedDB sebagai cache lokal, disinkronkan ke Supabase agar bisa dibuka dari perangkat mana pun. Login memakai email + password, dan setiap perubahan data tercatat dalam riwayat aktivitas. Bisa di-install ke homescreen Android/iOS seperti aplikasi biasa.

**Tujuan akhir (fase 2, opsional):** dibungkus jadi APK Android via Capacitor/TWA. Struktur proyek sudah disiapkan untuk itu sejak awal.

---

## Keputusan yang Sudah Diambil

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Bentuk aplikasi | **PWA installable** | Cepat, gratis, tanpa Play Store. Bisa jadi APK di fase 2 |
| Penyimpanan | **IndexedDB (cache) + Supabase Postgres (sumber kebenaran)** | UI tetap responsif & offline; data ikut akun sehingga bisa dibuka dari perangkat lain. Backup manual tetap tersedia via export/import JSON |
| Autentikasi | **Email + password (Supabase Auth)** | Paling sederhana dan tidak bergantung pada penyedia OAuth pihak ketiga |
| Aktivitas | **Login + perubahan data** | Login/logout, CRUD tugas, export/import, ubah setting. Page view tidak dicatat agar tabel tidak berisik |
| Keamanan | **Row Level Security** | Batas kepercayaan ada di database, bukan di UI. Tidak ada `service_role` di aplikasi |
| Pengingat | **Notifikasi browser/PWA** | Notification API dan service worker. Pengingat ketika app aktif; status deadline terlambat saat app dibuka kembali |
| Kerangka | **Astro + Svelte** | Astro untuk shell/halaman, Svelte untuk interaktivitas |
| Gaya | **Tailwind CSS v4** | Utility, tanpa file config terpisah (via `@tailwindcss/vite`) |
| Bahasa | **Indonesia** | Bahasa utama UI |

---

## Stack Teknis

| Bagian | Teknologi | Versi |
|---|---|---|
| Framework | Astro | ^7.4.4 |
| UI interaktif | Svelte | ^5.57.3 |
| Integrasi Svelte | @astrojs/svelte | ^9.1.2 |
| PWA | vite-plugin-pwa (dipasang langsung sebagai Vite plugin) | ^2.0.0 |
| CSS | Tailwind CSS v4 | ^4.3.3 |
| Vite plugin Tailwind | @tailwindcss/vite | ^4.3.3 |
| Database lokal | idb (IndexedDB) | ^8.0.4 |
| Backend | @supabase/supabase-js | ^2 |
| Manipulasi tanggal | date-fns | ^4.4.0 |
| Tipe | TypeScript | ^5.9.0 |
| Test | Vitest | ^5.0.5 |

> Catatan versi: `vite-plugin-pwa` dipasang langsung di `vite.plugins` pada `astro.config.mjs`, tanpa wrapper `@vite-pwa/astro`. Ini menghindari peer dependency wrapper yang belum mencakup Astro 7. Versi plugin tetap harus cocok dengan versi Vite yang dipakai Astro.

---

## Konfigurasi & Environment

Variabel di `.env` (sudah masuk `.gitignore`, contoh ada di `.env.example`):

```bash
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Hanya kunci publik yang dipakai di client. Tidak ada `service_role` di aplikasi, dan seluruh izin data ditegakkan oleh RLS.

Pengaturan Supabase yang diperlukan:

| Setelan | Nilai | Alasan |
|---|---|---|
| Auth provider Email | Aktif | Login email + password |
| Confirm email | Nonaktif saat pengembangan | Supaya daftar langsung dapat sesi; aktifkan untuk produksi |
| Site URL / Redirect URLs | `http://localhost:4321` (+ domain produksi) | Callback auth |

Project aktif: `vuvhfckwqilvdjfckkmk`, region `eu-central-1`, Postgres 17.

---

## Arsitektur Halaman

Struktur file (rincian teknis di `architecture.md`):

```
src/
├── pages/
│   ├── index.astro          # Dashboard: tugas hari ini, terlambat, ringkasan
│   ├── login.astro          # Masuk / daftar (tanpa AppShell)
│   ├── tasks/
│   │   ├── index.astro      # Daftar semua tugas (filter + pencarian)
│   │   └── detail.astro     # Detail satu tugas (query ?id=...)
│   ├── calendar.astro       # Tampilan kalender bulanan
│   ├── activity.astro       # Riwayat aktivitas + riwayat masuk
│   ├── settings.astro       # Pengaturan (akun, notifikasi, tema, export/import)
│   └── 404.astro
├── components/              # Astro components + Svelte islands
├── lib/                     # db, supabase, auth, sync, activity, dates, notifications
└── styles/
    └── global.css           # Tailwind + design tokens
```

Halaman detail tugas (`tasks/[id].astro`) tidak memakai `getStaticPaths` karena data dinamis; 404 ditangani di sisi klien oleh komponen Svelte.

---

## Model Data

```ts
interface Task {
  id: string;              // crypto.randomUUID()
  title: string;           // wajib
  description?: string;
  dueDate: string;         // ISO 8601, wajib
  dueTime?: string;        // "HH:mm", opsional
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'done';
  category?: string;       // opsional, untuk filter
  notify: boolean;         // apakah pasang notifikasi
  createdAt: string;
  completedAt?: string;
}
```

### Tabel server (Supabase)

| Tabel | Isi |
|---|---|
| `profiles` | Profil publik per user, dibuat otomatis oleh trigger saat signup |
| `tasks` | Salinan tugas per user. `deleted_at` dipakai sebagai tombstone agar penghapusan ikut tersinkron |
| `login_events` | Riwayat `signup` / `login` / `logout` |
| `activity_log` | Log append-only: `task_created`, `task_updated`, `task_completed`, `task_reopened`, `task_deleted`, `export`, `import`, `settings_changed` |

Semua tabel dilindungi RLS `user_id = auth.uid()`. `login_events` dan `activity_log` tidak punya policy update/delete, jadi jejak tidak bisa diubah dari klien.

---

## Fitur (MVP)

1. **CRUD tugas**: tambah, edit, hapus, tandai selesai
2. **Dashboard**: ringkasan (total, hari ini, terlambat, selesai), daftar prioritas
3. **Filter & pencarian**: by status, prioritas, kategori, teks
4. **Tampilan kalender**: kalender bulanan dengan penanda tugas per tanggal
5. **Notifikasi**: izin browser + pengingat saat deadline jika aplikasi terbuka. Saat aplikasi ditutup, yang dijamin hanya status tugas terlambat ketika app dibuka kembali.
6. **PWA**: installable, offline, splash screen, icon
7. **Export/import JSON**: backup & restore data
8. **Akun**: daftar/masuk dengan email + password, sesi persisten, tombol keluar di sidebar dan Pengaturan
9. **Sinkronisasi**: tugas terkirim ke akun saat online, ditarik ulang otomatis saat app dibuka, tab kembali aktif, atau event `online`
10. **Riwayat aktivitas**: halaman `/activity` berisi timeline perubahan data dan riwayat masuk

---

## Fitur Non-Fitur (di luar cakupan)

- ❌ Kolaborasi / berbagi tugas antar user
- ❌ Reminder email atau web push (butuh server VAPID)
- ❌ Login sosial (Google/GitHub) — bisa ditambah tanpa perubahan skema
- ❌ Audit log yang tahan manipulasi (butuh Edge Function + `service_role`)
- ❌ APK native (fase 2, setelah PWA stabil)

---

## Milestones & Estimasi

| Milestone | Isi | Perkiraan |
|---|---|---|
| M1 — Skafold | Setup Astro + Svelte + Tailwind + PWA, shell layout | 1 hari |
| M2 — Data layer | Tipe, IndexedDB CRUD, helper tanggal, store | 1 hari |
| M3 — UI core | Dashboard, daftar tugas, form, badge status | 2 hari |
| M4 — Kalender | Tampilan bulanan + penanda tugas | 1 hari |
| M5 — Notifikasi | Izin browser dan reminder selama app aktif | Selesai |
| M6 — PWA & polish | Manifest, service worker, export/import, empty states | 1 hari |
| M7 — Test & QA | Vitest untuk db/dates, uji manual di phone | 1 hari |
| M8 — Auth & backend | Project Supabase, skema + RLS, halaman login, guard | Selesai |
| M9 — Sync & aktivitas | Outbox IndexedDB, push/pull, logging, halaman riwayat | Selesai |

**Total: ~10 hari kerja** (bisa lebih cepat jika dikerjakan penuh).

---

## Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Notifikasi tidak jalan saat app tertutup | Reminder real-time tidak dijamin oleh timer browser | Catch-up badge "terlambat" saat app dibuka; notifikasi push perlu backend atau wrapper native |
| Kompatibilitas versi Astro 7 + Svelte 9 | Build gagal | Sudah dicek. Jika bentrok, turunkan @astrojs/svelte ke ^8 |
| IndexedDB tidak tersedia (mode privat lama) | Data tidak tersimpan | Fallback ke localStorage + peringatan |
| Data hilang jika hapus browser | Kehilangan cache lokal | Data sudah ada di server per akun; export JSON tetap tersedia sebagai cadangan tambahan |
| Konflik edit dua perangkat | Perubahan salah satu tertimpa | Last-write-wins dengan `updated_at` server; perubahan lokal yang masih `pending` tidak ditimpa saat pull |
| Log aktivitas dipalsukan | Audit tidak tepercaya | Diterima sebagai batasan; audit serius butuh Edge Function dengan `service_role` |
| Kunci Supabase bocor | Akses data user lain | Hanya publishable/anon key di client; seluruh akses dibatasi RLS. Advisor keamanan Supabase dicek bersih |
| Latensi region Frankfurt | Login/pull awal terasa lambat | UI baca-tulis lokal lebih dulu; hanya operasi jaringan yang menunggu |

---

## Definisi Selesai (Definition of Done)

- [ ] Semua fitur MVP jalan di browser desktop & mobile
- [ ] Offline: buka app tanpa jaringan → masih berfungsi (baca & tulis)
- [ ] Installable: tombol "Add to Home Screen" muncul di Chrome/Android
- [ ] Notifikasi: izin diminta dan reminder diuji pada browser/perangkat target (belum terverifikasi pada perangkat nyata)
- [ ] Export → import → data kembali utuh
- [ ] `npm run build` sukses tanpa error
- [ ] Test Vitest untuk `db.ts` dan `dates.ts` lolos
- [ ] Tidak ada console error di production
- [x] **Antislop Delivery Gate**: type-check, build, unit test, responsive check dan alur interaksi browser sudah dilakukan. Verifikasi perangkat nyata masih diperlukan.

### Tambahan untuk auth & sync

- [x] Skema + RLS terpasang, advisor keamanan Supabase bersih (0 lint)
- [x] Fungsi `handle_new_user()` tidak bisa dipanggil lewat `/rest/v1/rpc`
- [x] Trigger `on_auth_user_created` membuat baris `profiles` otomatis
- [x] RLS terverifikasi: user lain melihat 0 baris di keempat tabel
- [x] `activity_log` append-only: UPDATE/DELETE oleh user menghasilkan 0 baris
- [x] Login → dashboard, email tampil di sidebar, logout kembali ke `/login`
- [x] Tugas dibuat di UI muncul di tabel `tasks` beserta `activity_log` dan `login_events`
- [x] Dua "perangkat" (cache dikosongkan): tugas dari perangkat lain ikut terunduh
- [x] Hapus tugas menyebar lewat tombstone `deleted_at`, perangkat lain ikut menghapus
- [x] Offline: tambah tugas tetap berhasil lokal, terkirim ke server setelah `online`
- [x] `astro check` 0 error / 0 warning; `vitest run` 6/6; `astro build` sukses
- [ ] **Konfirmasi email masih aktif** — setel `Confirm email = OFF` di dashboard Supabase agar daftar langsung dapat sesi. Token OAuth MCP tidak punya scope `auth_config_write`, jadi langkah ini manual
- [ ] Tugas dari versi pra-auth (`markAllPending`) belum diuji dengan data nyata

---

## Fase 2 (Opsional) — APK Android

Setelah MVP stabil:

1. `npm install @capacitor/core @capacitor/cli @capacitor/android`
2. `npx cap init TaskPulse` → `npx cap add android`
3. `npx cap sync` → build → `npx cap open android` → build APK via Android Studio

Ini menghasilkan `.apk` yang bisa di-install langsung tanpa Play Store. Struktur `src` tidak berubah; hanya perlu tambahan folder `android/`. Langkah APK belum dijalankan karena MVP ini adalah PWA; butuh Android Studio/SDK dan dilakukan sebagai fase terpisah.
