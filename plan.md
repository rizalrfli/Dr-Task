# Plan: TaskPulse — Pengingat Tugas & Deadline

## Ringkasan

Aplikasi web (PWA installable) untuk mengingat tugas dan deadline. Berjalan offline-first, data disimpan lokal di IndexedDB, tanpa login, tanpa server backend. Bisa di-install ke homescreen Android/iOS seperti aplikasi biasa.

**Tujuan akhir (fase 2, opsional):** dibungkus jadi APK Android via Capacitor/TWA. Struktur proyek sudah disiapkan untuk itu sejak awal.

---

## Keputusan yang Sudah Diambil

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Bentuk aplikasi | **PWA installable** | Cepat, gratis, tanpa Play Store. Bisa jadi APK di fase 2 |
| Penyimpanan | **Lokal (IndexedDB)** | Offline-first, tanpa akun, data tetap di device. Backup via export/import JSON |
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
| Manipulasi tanggal | date-fns | ^4.4.0 |
| Tipe | TypeScript | ^5.9.0 |
| Test | Vitest | ^5.0.5 |

> Catatan versi: `vite-plugin-pwa` dipasang langsung di `vite.plugins` pada `astro.config.mjs`, tanpa wrapper `@vite-pwa/astro`. Ini menghindari peer dependency wrapper yang belum mencakup Astro 7. Versi plugin tetap harus cocok dengan versi Vite yang dipakai Astro.

---

## Arsitektur Halaman

Struktur file (rincian teknis di `architecture.md`):

```
src/
├── pages/
│   ├── index.astro          # Dashboard: tugas hari ini, terlambat, ringkasan
│   ├── tasks/
│   │   ├── index.astro      # Daftar semua tugas (filter + pencarian)
│   │   └── [id].astro       # Detail satu tugas
│   ├── calendar.astro       # Tampilan kalender bulanan
│   ├── settings.astro       # Pengaturan (notifikasi, tema, export/import)
│   └── 404.astro
├── components/              # Astro components + Svelte islands
├── lib/                     # db, dates, notifications, store
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

---

## Fitur (MVP)

1. **CRUD tugas**: tambah, edit, hapus, tandai selesai
2. **Dashboard**: ringkasan (total, hari ini, terlambat, selesai), daftar prioritas
3. **Filter & pencarian**: by status, prioritas, kategori, teks
4. **Tampilan kalender**: kalender bulanan dengan penanda tugas per tanggal
5. **Notifikasi**: izin browser + pengingat saat deadline jika aplikasi terbuka. Saat aplikasi ditutup, yang dijamin hanya status tugas terlambat ketika app dibuka kembali.
6. **PWA**: installable, offline, splash screen, icon
7. **Export/import JSON**: backup & restore data

---

## Fitur Non-Fitur (di luar MVP)

- ❌ Login / multi-device sync
- ❌ Kolaborasi / berbagi tugas
- ❌ Reminder email
- ❌ Server backend
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

**Total: ~8 hari kerja** (bisa lebih cepat jika dikerjakan penuh).

---

## Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Notifikasi tidak jalan saat app tertutup | Reminder real-time tidak dijamin oleh timer browser | Catch-up badge "terlambat" saat app dibuka; notifikasi push perlu backend atau wrapper native |
| Kompatibilitas versi Astro 7 + Svelte 9 | Build gagal | Sudah dicek. Jika bentrok, turunkan @astrojs/svelte ke ^8 |
| IndexedDB tidak tersedia (mode privat lama) | Data tidak tersimpan | Fallback ke localStorage + peringatan |
| Data hilang jika hapus browser | Kehilangan semua tugas | Tombol export JSON selalu ada di settings |

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

---

## Fase 2 (Opsional) — APK Android

Setelah MVP stabil:

1. `npm install @capacitor/core @capacitor/cli @capacitor/android`
2. `npx cap init TaskPulse` → `npx cap add android`
3. `npx cap sync` → build → `npx cap open android` → build APK via Android Studio

Ini menghasilkan `.apk` yang bisa di-install langsung tanpa Play Store. Struktur `src` tidak berubah; hanya perlu tambahan folder `android/`. Langkah APK belum dijalankan karena MVP ini adalah PWA; butuh Android Studio/SDK dan dilakukan sebagai fase terpisah.
