# Architecture: TaskPulse

Arsitektur teknis untuk pengingat tugas & deadline. Pendamping `plan.md` (tujuan & roadmap) dan `design.md` (tampilan).

## Prinsip

1. **Static-first.** Astro merender shell halaman saat build. Tidak ada server runtime. Semua halaman static (`output: 'static'`), di-cache oleh service worker untuk mendukung penggunaan offline.
2. **Klien adalah sumber kebenaran.** IndexedDB memegang semua data. Tidak ada API remote, tidak ada auth, tidak ada sinkronisasi di MVP.
3. **Island arsitektur.** Astro HTML statis + komponen Svelte terhidrasi hanya di area interaktif (daftar, form, kalender). Bundle JS minimal.
4. **Lapisan data berdiri sendiri.** `lib/db.ts` adalah satu-satunya pintu ke IndexedDB. UI tidak pernah menyentuh `idb` langsung → testable, bisa ditukar.

## Stack

| Bagian | Paket | Versi terverifikasi | Catatan |
|---|---|---|---|
| Framework | astro | ^7.4.4 | butuh vite ^8 (built-in di astro 7) |
| UI islands | svelte | ^5.57.3 | runes `$state`/`$derived` |
| Integrasi | @astrojs/svelte | ^9.1.2 | peer: astro ^7 ✓ |
| PWA | vite-plugin-pwa | ^2.0.0 | pasang langsung sebagai Vite plugin; cocokkan peer Vite |
| Styling | tailwindcss + @tailwindcss/vite | ^4.3.3 | config via CSS `@theme`, bukan tailwind.config.js |
| DB | idb | ^8.0.4 | promise wrapper IndexedDB |
| Tanggal | date-fns | ^4.4.0 | manipulasi + format tanggal |
| Test | vitest | ^5.0.5 | environment jsdom untuk db, node untuk dates |

Catatan: versi paket di sini adalah baseline dokumen. Saat implementasi, pin versi pasti yang peer dependencies-nya cocok dan simpan lockfile.

## Struktur folder

```
taskpulse/
├── public/
│   ├── icons/               # icon PWA 192/512 + maskable
│   └── favicon.svg
├── src/
│   ├── pages/
│   │   ├── index.astro          # Dashboard
│   │   ├── tasks/index.astro    # Daftar tugas
│   │   ├── tasks/detail.astro   # Detail berdasarkan query ?id=...
│   │   ├── calendar.astro       # Kalender bulanan
│   │   ├── settings.astro       # Pengaturan + export/import
│   │   └── 404.astro
│   ├── components/
│   │   ├── AppShell.astro        # head, header, bottom-nav, slot
│   │   ├── Icon.astro            # set simbol inline (stroke 1.5)
│   │   ├── islands/
│   │   │   ├── DashboardStats.svelte
│   │   │   ├── TaskList.svelte
│   │   │   ├── TaskForm.svelte
│   │   │   ├── TaskDetail.svelte
│   │   │   ├── MonthCalendar.svelte
│   │   │   └── SettingsPanel.svelte
│   ├── lib/
│   │   ├── types.ts              # Task, Priority, TaskStatus, FilterState
│   │   ├── db.ts                 # openDB, CRUD Task
│   │   ├── dates.ts              # dueBucket, daysRemaining, formatID
│   │   ├── notifications.ts      # Notification API + scheduler
│   │   ├── export_import.ts      # toJSON/fromJSON
│   │   └── store.svelte.ts       # store tasks reaktif (runes)
│   └── styles/
│       └── global.css            # @import "tailwindcss"; @theme custom
├── astro.config.mjs
├── tsconfig.json
├── package.json
└── vitest.config.ts
```

## Data

### Skema Task

```ts
export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'done';
export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

export interface Task {
  id: string;                 // crypto.randomUUID()
  title: string;
  description?: string;
  dueDate: string;            // ISO date 'YYYY-MM-DD' (lokal, bukan UTC)
  dueTime?: string;           // 'HH:mm'
  priority: Priority;
  status: TaskStatus;
  category?: string;
  notify: boolean;
  createdAt: string;          // ISO datetime
  completedAt?: string;
}

export interface FilterState {
  bucket: 'all' | DueBucket;
  priority: 'all' | Priority;
  query: string;
}
```

### IndexedDB

Satu database `taskpulse-db` v1, satu object store `tasks`, keyPath `id`.

Index:
- `byDueDate` pada `dueDate` → query rentang tanggal dashboard/kalender.
- `byStatus` pada `status` → filter cepat.
- `byPriority` pada `priority`.

Put/hapus via `idb`. Tidak ada ORM. Tidak ada migrasi di MVP; bump versi DB hanya saat skema berubah, dengan callback `upgrade()` yang menulis ulang index.

### Kenapa bukan localStorage

- List tugas membengkak (ratusan baris + deskripsi) → localStorage (±5 MB, sinkron, blok main thread) jadi bottleneck.
- IndexedDB skala besar, indeks bawaan, async. `idb` menyembunyikan callback.

## Alur data

```
IndexedDB  ⇄  lib/db.ts  ⇄  lib/store.svelte.ts ($state)  ⇄  Svelte islands
                   ⇣
              lib/dates.ts          (klasifikasi deadline)
              lib/notifications.ts  (jadwal + tampilkan)
```

- `store.svelte.ts` memuat seluruh list ke memori saat hidrasi (`loadTasks()`). Derivasi (filter, urut, statistik) via `$derived` di komponen.
- Terlalu besar nanti? Pindah ke query per-index per halaman. MVP cukup dengan memori.
- Mutasi (`addTask/updateTask/deleteTask`) menulis ke DB dulu, baru update store. Jika DB gagal → roll back store + toast.

## Notifikasi

`lib/notifications.ts`:

1. `requestPermission()` → `Notification.requestPermission()`. Hasil disimpan ke `store`.
2. `scheduleReminder(task)`:
   - Hitung ms hingga deadline (pakai `dueDate` + `dueTime`, default 09:00).
   - API lama → simpan timeout ke Map; API baru (`registration.showNotification`) → `RegistrationManager`
3. Saat deadline tiba: tampilkan notifikasi (title + body + tag unik).
4. Saat app ditutup/sistem mati: fallback. Lihat "Keterbatasan" di bawah.

Izin default value: `default`. Hubungi `requestPermission` **hanya** dari gestur klik (aturan browser) → `NotificationToggle.svelte`.

## Service worker & offline

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  integrations: [svelte()],
  vite: {
    plugins: [
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: 'TaskPulse',
          short_name: 'TaskPulse',
          lang: 'id',
          start_url: '/',
          display: 'standalone',
          background_color: '#F5F3EE',
          theme_color: '#F5F3EE',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: '/',
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
    ],
  },
});
```

- Strategi: precache shell statis; runtime cache gambar/font via stale-while-revalidate (default).
- Update: `registerType: 'prompt'` + banner toast → reload (hindari refresh diam-diam).

## Routing

| Path | Halaman | Island utama |
|---|---|---|
| `/` | Dashboard: statistik + daftar overdue/hari ini | `DashboardStats`, `TaskList` |
| `/tasks` | Semua tugas + filter + search | `TaskList`, `TaskForm` (tambah) |
| `/tasks/detail?id=...` | Detail satu tugas | `TaskDetail` |
| `/calendar` | Kalender bulanan + tugas per tanggal | `MonthCalendar` |
| `/settings` | Tema, notifikasi, export/import | `SettingsPanel` |
| `/*` | 404 | — |

Route statis `/tasks/detail?id=...` membaca ID dari query string di klien, sehingga bisa di-deploy tanpa fallback server. Jangan pakai `getStaticPaths` + data dummy.

## Tema

`dark` via `<html class="dark">`. Default: tanpa kelas (terang). Toggle Scope: `localStorage('theme')`. Deteksi `prefers-color-scheme` saat first visit. Penerapan: custom properties Tailwind `@theme` + `dark:` variant. Hindari FOUC: skrip inline kecil di `<head>` sebelum render.

## Aksesibilitas & target sentuh

- Tap target ≥ 44×44 px (checkbox, tombol nav, ikon aksi).
- Status warna **tidak** sendirian: selalu punya teks (Contoh: badge "Terlambat", bukan titik merah).
- Fokus terlihat: `outline` aksen; jangan `outline: none` tanpa pengganti.
- Semua aksi hover punya padan tombol.

## Build & deploy

```bash
npm run dev      # dev server
npm run build    # output ke dist/ (statis murni)
npm run preview  # uji hasil build
npm test         # vitest
```

`dist/` statis → deploy ke host statik (Netlify/Vercel/GitHub Pages). Config `site` Astro: tidak perlu di MVP.

## Test

Vitest, 2 area:

1. `lib/dates.test.ts` — klasifikasi `dueBucket` & sisa hari. Waktu relatif: pakai parameter fungsi `today` (injectable) atau mock `Date`.
2. `lib/db.test.ts` — CRUD pakai `fake-indexeddb` (devDep) di environment jsdom.

Island UI: test manual + satu e2e happy-path (tambah tugas → muncul di daftar) bila perlu. MVP: tidak menambah framework e2e.

## Keterbatasan yang disadari (honest constraints MVP)

1. **Notifikasi tutup-tab.** Timer in-memory mati saat tab tertutup. Web Push butuh server VAPID di luar scope MVP. Solusi sementara: catch-up saat app dibuka (tugas yang sudah lewat → tampilkan badge). User melihat deadline terlewat di dashboard, bukan notifikasi real-time. Dokumentasikan ini di settings.
2. **Satu device.** Tak ada sync antar device (konsekuensi dari keputusan IndexedDB-only). Backup manual via export JSON.
3. **Full-Text Search.** Data besar → linear scan lambat? MVP scan memory; index search memori sampai ribuan baris tidak masalah.
4. **Zona waktu.** `dueDate` disimpan sebagai `YYYY-MM-DD` lokal; migrasi ke timestamp UTC dipertimbangkan bila ada fitur lintas zona waktu.

## Fase 2 — APK

Setelah stabil: pasang Capacitor, `npx cap add android`, `npx cap sync`, build APK. Island arsitektur tidak berubah; `webDir: 'dist'`. Push notification native (jalan saat app tertutup) memungkinkan lewat FCM — backlog fase 2.
