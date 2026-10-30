# Architecture: TaskPulse

Arsitektur teknis untuk pengingat tugas & deadline. Pendamping `plan.md` (tujuan & roadmap) dan `design.md` (tampilan).

## Prinsip

1. **Static-first, dengan backend terkelola.** Astro merender shell halaman saat build (`output: 'static'`), di-cache service worker untuk offline. Tidak ada server runtime milik sendiri; backend sepenuhnya Supabase (Postgres + Auth).
2. **Lokal dulu, server menyusul.** IndexedDB tetap jalur baca-tulis utama agar UI tidak menunggu jaringan. Supabase adalah sumber kebenaran lintas perangkat; IndexedDB adalah cache + antrean tulis.
3. **Island arsitektur.** Astro HTML statis + komponen Svelte terhidrasi hanya di area interaktif (daftar, form, kalender). Bundle JS minimal.
4. **Lapisan data berdiri sendiri.** `lib/db.ts` satu-satunya pintu ke IndexedDB, `lib/sync.ts` satu-satunya pintu sinkronisasi, `lib/activity.ts` satu-satunya pintu pencatatan aktivitas. UI tidak menyentuh `idb` atau `supabase` langsung.
5. **Keamanan di database, bukan di UI.** Row Level Security adalah batas kepercayaan sebenarnya. Gerbang login di `AppShell` hanya kosmetik untuk mencegah kilatan konten.

## Stack

| Bagian | Paket | Versi terverifikasi | Catatan |
|---|---|---|---|
| Framework | astro | ^7.4.4 | butuh vite ^8 (built-in di astro 7) |
| UI islands | svelte | ^5.57.3 | runes `$state`/`$derived` |
| Integrasi | @astrojs/svelte | ^9.1.2 | peer: astro ^7 ✓ |
| PWA | vite-plugin-pwa | ^2.0.0 | pasang langsung sebagai Vite plugin; cocokkan peer Vite |
| Styling | tailwindcss + @tailwindcss/vite | ^4.3.3 | config via CSS `@theme`, bukan tailwind.config.js |
| DB lokal | idb | ^8.0.4 | promise wrapper IndexedDB |
| Backend | @supabase/supabase-js | ^2 | Auth + Postgres + RLS |
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
│   │   ├── login.astro          # Masuk / daftar (tanpa AppShell)
│   │   ├── tasks/index.astro    # Daftar tugas
│   │   ├── tasks/detail.astro   # Detail berdasarkan query ?id=...
│   │   ├── calendar.astro       # Kalender bulanan
│   │   ├── activity.astro       # Riwayat aktivitas + riwayat masuk
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
│   │   │   ├── SettingsPanel.svelte
│   │   │   ├── AuthForm.svelte
│   │   │   └── ActivityLog.svelte
│   ├── lib/
│   │   ├── types.ts              # Task, Priority, TaskStatus, FilterState
│   │   ├── db.ts                 # IndexedDB: tasks, sync, activity_outbox
│   │   ├── supabase.ts           # klien Supabase (anon key + RLS)
│   │   ├── auth.ts               # signUp/signIn/signOut, pesan error ID
│   │   ├── sync.ts               # push/pull tugas + auto-sync
│   │   ├── activity.ts           # logActivity, flushActivity, login_events
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

Database `taskpulse-db` v2, tiga object store:

| Store | keyPath | Isi |
|---|---|---|
| `tasks` | `id` | Data `Task` apa adanya |
| `sync` | `id` | `{ pending, updatedAt, deletedAt? }` — status sinkronisasi per tugas, termasuk tombstone |
| `activity_outbox` | `localId` (autoIncrement) | Event aktivitas yang belum terkirim |

Index `tasks`: `byDueDate`, `byStatus`, `byPriority` → query dashboard/kalender.

Migrasi v1 → v2 hanya menambah `sync` dan `activity_outbox`; data tugas lama tidak disentuh. Metadata sinkronisasi sengaja dipisah dari `Task` agar bentuk tipe `Task` tetap murni dan `export_import.ts` tidak perlu tahu soal sync.

`getTasks()` menyaring tugas yang punya tombstone di `sync`, jadi UI tidak pernah melihat tugas yang sudah dihapus.

### Kenapa bukan localStorage

- List tugas membengkak (ratusan baris + deskripsi) → localStorage (±5 MB, sinkron, blok main thread) jadi bottleneck.
- IndexedDB skala besar, indeks bawaan, async. `idb` menyembunyikan callback.

## Database server (Supabase)

Project: `vuvhfckwqilvdjfckkmk`, region `eu-central-1`, Postgres 17. Kredensial hanya `anon`/publishable key di `PUBLIC_*` env; tidak ada `service_role` di aplikasi.

### Tabel

| Tabel | Kolom kunci | Catatan |
|---|---|---|
| `profiles` | `id` (= `auth.users.id`), `email`, `full_name`, `last_seen_at` | Dibuat otomatis oleh trigger `on_auth_user_created` |
| `tasks` | `id` (text, dari client), `user_id`, `due_date`, `due_time`, `priority`, `status`, `notify`, `updated_at`, `deleted_at` | `deleted_at` = soft delete untuk sinkronisasi |
| `login_events` | `user_id`, `event` (`signup`/`login`/`logout`), `method`, `user_agent` | Append-only |
| `activity_log` | `user_id`, `event_type`, `entity_type`, `entity_id`, `path`, `metadata` (jsonb), `user_agent` | Append-only |

Trigger `tasks_set_updated_at` menjaga `updated_at` di sisi server, jadi konflik bisa diselesaikan dengan last-write-wins tanpa bergantung pada jam klien.

### RLS

Semua tabel `enable row level security`, tanpa policy permisif untuk `anon`.

| Tabel | select | insert | update | delete |
|---|---|---|---|---|
| `profiles` | own | — (trigger) | own | — |
| `tasks` | own | own | own | own |
| `login_events` | own | own | — | — |
| `activity_log` | own | own | — | — |

Semua policy memakai `(select auth.uid())` agar di-cache sebagai initplan, bukan dievaluasi per baris.

### Fungsi

- `handle_new_user()` — `security definer`, `search_path` dikunci kosong, `EXECUTE` dicabut dari `anon`/`authenticated` supaya tidak bisa dipanggil lewat `/rest/v1/rpc`.
- `set_updated_at()` — `search_path` dikunci kosong.

Advisor keamanan Supabase bersih setelah dua perbaikan ini.

## Alur data

```
        tulis                              baca
Svelte ──────▶ lib/db.ts (IndexedDB) ◀────── Svelte
                   │      ▲
                   │      │ terapkan hasil
                   ▼      │
              lib/sync.ts ──▶ Supabase (RLS)
                   │
                   ▼
             lib/activity.ts ──▶ activity_log / login_events
```

- **Baca**: UI selalu baca IndexedDB. Tidak ada spinner menunggu jaringan.
- **Tulis**: `saveTask`/`removeTask` menulis IndexedDB lalu menandai `pending`. `syncNow()` mengirim semua perubahan tertunda, baru menarik ulang seluruh daftar dari server.
- **Hapus**: push memakai soft delete (`deleted_at`), bukan `DELETE`, supaya perangkat lain menerima tombstone saat pull dan ikut menghapus salinan lokalnya.
- **Konflik**: last-write-wins. Perubahan lokal yang masih `pending` tidak ditimpa saat pull, supaya aksi offline tidak hilang.
- **Auto-sync**: dipicu saat mount, saat event `online`, saat tab kembali visible, dan tiap 60 detik. Dijalankan dari `AppShell`, jadi berlaku di semua halaman.
- **Offline**: semua aksi tetap berhasil secara lokal; `syncNow()` gagal diam-diam dan dicoba lagi pada pemicu berikutnya.

### Login pertama di perangkat lama

`markAllPending()` menandai tugas IndexedDB yang belum punya baris `sync` (data dari versi pra-auth) agar ikut terkirim pada `syncNow()` pertama. Ini yang membuat data lama tidak hilang setelah upgrade.

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

## Keterbatasan yang disadari (honest constraints)

1. **Notifikasi tutup-tab.** Timer in-memory mati saat tab tertutup. Web Push butuh server VAPID di luar scope. Solusi sementara: catch-up saat app dibuka (tugas yang sudah lewat → tampilkan badge). User melihat deadline terlewat di dashboard, bukan notifikasi real-time. Dokumentasikan ini di settings.
2. **Sync satu arah per siklus.** `syncNow()` push lalu pull seluruh daftar, bukan delta per kolom. Cukup untuk ratusan tugas; kalau daftar membesar, ganti pull menjadi `updated_at > last_pull`.
3. **Konflik last-write-wins.** Dua perangkat mengedit tugas yang sama secara offline → yang push terakhir menang, tanpa dialog merge. `deleted_at` menang atas edit hanya jika push-nya lebih akhir.
4. **Log aktivitas bisa dipalsukan.** Insert `activity_log` dan `login_events` dilakukan dari browser dengan token user sendiri. User teknis bisa mengirim event palsu lewat REST API. Audit yang tepercaya butuh Edge Function dengan `service_role`.
5. **`failed_login` dan IP tidak tercatat.** Percobaan login gagal terjadi sebelum ada session, jadi tidak ada token untuk insert. IP hanya tersedia di sisi server (`auth.audit_log_entries`, butuh service role).
6. **Offline lama butuh reconnect.** Token akses berumur ±1 jam. Melewati itu, data lokal tetap terbaca tapi sync dan log tertunda sampai online sekali.
7. **Gerbang login bersifat kosmetik.** Redirect di `<head>` mencegah kilatan konten, bukan proteksi. Batas kepercayaan sebenarnya adalah RLS.
8. **Full-Text Search.** Data besar → linear scan lambat? Scan memory sampai ribuan baris masih wajar.
9. **Zona waktu.** `dueDate` disimpan sebagai `YYYY-MM-DD` lokal; migrasi ke timestamp UTC dipertimbangkan bila ada fitur lintas zona waktu.
10. **Latensi region.** Server di `eu-central-1` (Frankfurt), user di Indonesia ±150–200 ms per round trip. Tidak terasa karena UI baca-tulis lokal; hanya login pertama dan pull awal yang menunggu.

## Fase 2 — APK

Setelah stabil: pasang Capacitor, `npx cap add android`, `npx cap sync`, build APK. Island arsitektur tidak berubah; `webDir: 'dist'`. Push notification native (jalan saat app tertutup) memungkinkan lewat FCM — backlog fase 2.
