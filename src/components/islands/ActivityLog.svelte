<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '../../lib/supabase';

  interface ActivityRow {
    id: number;
    event_type: string;
    entity_type: string | null;
    entity_id: string | null;
    path: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }
  interface LoginRow {
    id: number;
    event: string;
    method: string | null;
    created_at: string;
  }

  type Filter = 'all' | 'tasks' | 'backup' | 'settings';

  let rows = $state<ActivityRow[]>([]);
  let logins = $state<LoginRow[]>([]);
  let loading = $state(true);
  let error = $state('');
  let filter = $state<Filter>('all');

  const labels: Record<string, string> = {
    task_created: 'Tugas dibuat',
    task_updated: 'Tugas diubah',
    task_completed: 'Tugas diselesaikan',
    task_reopened: 'Tugas dibuka lagi',
    task_deleted: 'Tugas dihapus',
    export: 'Ekspor cadangan',
    import: 'Impor cadangan',
    settings_changed: 'Pengaturan diubah'
  };

  const groups: Record<Exclude<Filter, 'all'>, string[]> = {
    tasks: ['task_created', 'task_updated', 'task_completed', 'task_reopened', 'task_deleted'],
    backup: ['export', 'import'],
    settings: ['settings_changed']
  };

  const filtered = $derived(filter === 'all' ? rows : rows.filter((row) => groups[filter].includes(row.event_type)));

  function formatTime(value: string) {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
  function detail(row: ActivityRow) {
    const meta = row.metadata ?? {};
    if (typeof meta.title === 'string' && meta.title) return meta.title;
    if (typeof meta.count === 'number') return `${meta.count} item`;
    if (typeof meta.value === 'string') return meta.value;
    if (typeof meta.priority === 'string') return `prioritas ${meta.priority}`;
    return row.entity_type ?? '';
  }

  async function load() {
    loading = true; error = '';
    try {
      const [activity, login] = await Promise.all([
        supabase.from('activity_log').select('id,event_type,entity_type,entity_id,path,metadata,created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('login_events').select('id,event,method,created_at').order('created_at', { ascending: false }).limit(20)
      ]);
      if (activity.error) throw activity.error;
      if (login.error) throw login.error;
      rows = (activity.data ?? []) as ActivityRow[];
      logins = (login.data ?? []) as LoginRow[];
    } catch {
      error = 'Riwayat tidak bisa dimuat. Periksa koneksi lalu coba lagi.';
    } finally {
      loading = false;
    }
  }

  onMount(() => { void load(); });
</script>

<svelte:head><title>Riwayat Aktivitas · TaskPulse</title></svelte:head>

<section class="activity">
  <div class="toolbar">
    <label class="filter"><span class="sr-only">Filter jenis aktivitas</span>
      <select bind:value={filter}>
        <option value="all">Semua aktivitas</option>
        <option value="tasks">Perubahan tugas</option>
        <option value="backup">Cadangan</option>
        <option value="settings">Pengaturan</option>
      </select>
    </label>
    <button class="secondary-button" type="button" onclick={() => void load()} disabled={loading}>Muat ulang</button>
  </div>

  {#if error}<div class="notice" role="alert"><span>{error}</span><button type="button" onclick={() => void load()}>Coba lagi</button></div>{/if}

  {#if loading}
    <p class="state" role="status">Memuat riwayat…</p>
  {:else if filtered.length === 0}
    <div class="empty"><h2>Belum ada aktivitas</h2><p>Aktivitas akan muncul di sini setelah kamu mulai memakai aplikasi.</p></div>
  {:else}
    <ol class="timeline">
      {#each filtered as row (row.id)}
        <li>
          <span class="dot" aria-hidden="true"></span>
          <div class="entry">
            <p class="entry-title">{labels[row.event_type] ?? row.event_type}</p>
            {#if detail(row)}<p class="entry-detail">{detail(row)}</p>{/if}
            <time datetime={row.created_at}>{formatTime(row.created_at)}</time>
          </div>
        </li>
      {/each}
    </ol>
  {/if}

  {#if logins.length > 0}
    <section class="logins" aria-label="Riwayat masuk">
      <h2>Riwayat masuk</h2>
      <ul>
        {#each logins as row (row.id)}
          <li><span>{row.event === 'signup' ? 'Daftar' : row.event === 'login' ? 'Masuk' : 'Keluar'}</span><time datetime={row.created_at}>{formatTime(row.created_at)}</time></li>
        {/each}
      </ul>
    </section>
  {/if}
</section>

<style>
  .activity { display: grid; gap: 16px; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
  .filter select { min-height: 44px; padding: 0 30px 0 12px; border: 1px solid #DAD5C7; border-radius: 8px; background: #FFFDF8; color: #1C1B18; }
  .secondary-button { min-height: 44px; padding: 0 13px; border: 1px solid #DAD5C7; border-radius: 8px; background: #FFFDF8; color: #1C1B18; font: inherit; font-size: .84rem; font-weight: 600; cursor: pointer; }
  .secondary-button:disabled { opacity: .5; cursor: not-allowed; }
  .notice { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; padding: 12px; border: 1px solid #DAD5C7; border-radius: 10px; background: #FFFDF8; color: #A32017; }
  .notice button { min-height: 40px; border: 0; background: transparent; color: #9A3B1B; font-weight: 650; cursor: pointer; }
  .state { margin: 0; padding: 18px 0; color: #55524A; }
  .empty { padding: 32px 20px; border: 1px dashed #DAD5C7; border-radius: 10px; text-align: center; }
  .empty h2 { margin: 0 0 6px; font-size: 1.05rem; }
  .empty p { margin: 0; color: #55524A; font-size: .86rem; }
  .timeline { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
  .timeline li { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 12px; padding: 12px 0; border-bottom: 1px solid #ECE9E0; }
  .dot { width: 9px; height: 9px; margin-top: 6px; border-radius: 50%; background: #9A3B1B; justify-self: center; }
  .entry-title { margin: 0; font-weight: 620; font-size: .92rem; }
  .entry-detail { margin: 2px 0 0; color: #55524A; font-size: .84rem; overflow-wrap: anywhere; }
  .entry time { display: block; margin-top: 3px; color: #6B675C; font-size: .76rem; }
  .logins { margin-top: 8px; padding: 16px; border-radius: 10px; background: #ECE9E0; }
  .logins h2 { margin: 0 0 10px; font-size: .93rem; }
  .logins ul { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
  .logins li { display: flex; justify-content: space-between; gap: 12px; color: #55524A; font-size: .82rem; }
  .logins time { color: #6B675C; }
  :global(.dark) .filter select, :global(.dark) .secondary-button, :global(.dark) .notice { background: #201F1A; border-color: #34322B; color: #F0EDE3; }
  :global(.dark) .notice { color: #F0857A; }
  :global(.dark) .timeline li { border-color: #34322B; }
  :global(.dark) .entry-detail, :global(.dark) .state, :global(.dark) .empty p { color: #B5B0A2; }
  :global(.dark) .empty { border-color: #34322B; }
  :global(.dark) .logins { background: #201F1A; }
  :global(.dark) .logins li { color: #B5B0A2; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
</style>
