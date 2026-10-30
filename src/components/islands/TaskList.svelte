<script lang="ts">
  import { onMount } from 'svelte';
  import { compareTasks, dueBucket, dueLabel, formatDueDate } from '../../lib/dates';
  import { getTasks, removeTask, saveTask } from '../../lib/db';
  import { requestNotificationPermission, scheduleTaskReminder } from '../../lib/notifications';
  import type { Priority, Task } from '../../lib/types';

  let tasks = $state<Task[]>([]);
  let loading = $state(true);
  let error = $state('');
  let query = $state('');
  let bucket = $state('all');
  let priority = $state('all');
  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let title = $state('');
  let description = $state('');
  let dueDate = $state('');
  let dueTime = $state('');
  let taskPriority = $state<Priority>('medium');
  let category = $state('');
  let notify = $state(false);
  let saving = $state(false);
  let feedback = $state('');

  let { view = 'all' }: { view?: 'all' | 'open' } = $props();
  const filtered = $derived(tasks
    .filter((task) => view !== 'open' || task.status !== 'done')
    .filter((task) => !query.trim() || `${task.title} ${task.description ?? ''} ${task.category ?? ''}`.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')))
    .filter((task) => bucket === 'all' || dueBucket(task.dueDate) === bucket)
    .filter((task) => priority === 'all' || task.priority === priority)
    .sort((a, b) => a.status === b.status ? compareTasks(a, b) : a.status === 'pending' ? -1 : 1));

  async function refresh() {
    loading = true; error = '';
    try { tasks = await getTasks(); }
    catch { error = 'Daftar tugas tidak bisa dibuka. Coba muat ulang halaman.'; }
    finally { loading = false; }
  }
  function announceTaskChange() { window.dispatchEvent(new Event('taskpulse:tasks-changed')); }

  function clearForm() {
    title = ''; description = ''; dueDate = ''; dueTime = ''; taskPriority = 'medium'; category = ''; notify = false; editingId = null;
  }
  function openCreate() { clearForm(); showForm = true; }
  function openEdit(task: Task) {
    editingId = task.id; title = task.title; description = task.description ?? ''; dueDate = task.dueDate;
    dueTime = task.dueTime ?? ''; taskPriority = task.priority; category = task.category ?? ''; notify = task.notify; showForm = true;
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault(); if (saving) return;
    saving = true; feedback = '';
    try {
      if (notify) {
        const permission = await requestNotificationPermission();
        if (permission !== 'granted') throw new Error(permission === 'unsupported' ? 'Browser ini tidak mendukung notifikasi. Matikan opsi pengingat atau gunakan browser lain.' : 'Izin notifikasi belum diberikan. Izinkan notifikasi browser atau matikan opsi pengingat.');
      }
      const existing = editingId ? tasks.find((task) => task.id === editingId) : undefined;
      const task: Task = { id: editingId ?? crypto.randomUUID(), title: title.trim(), description: description.trim() || undefined,
        dueDate, dueTime: dueTime || undefined, priority: taskPriority, status: existing?.status ?? 'pending',
        category: category.trim() || undefined, notify, createdAt: existing?.createdAt ?? new Date().toISOString(), completedAt: existing?.completedAt };
      await saveTask(task); await refresh(); scheduleTaskReminder(task); announceTaskChange(); showForm = false; clearForm();
      feedback = existing ? 'Perubahan tugas disimpan.' : 'Tugas ditambahkan.';
    } catch (reason) { error = reason instanceof Error ? reason.message : 'Tugas gagal disimpan. Periksa ruang penyimpanan perangkat lalu coba lagi.'; }
    finally { saving = false; }
  }
  async function toggleDone(task: Task) {
    try {
      await saveTask({ ...task, status: task.status === 'done' ? 'pending' : 'done', completedAt: task.status === 'done' ? undefined : new Date().toISOString() });
      await refresh(); announceTaskChange();
    } catch { error = 'Status tugas gagal diperbarui. Coba lagi.'; }
  }
  async function deleteTask(task: Task) {
    if (!window.confirm(`Hapus tugas “${task.title}”? Tindakan ini tidak bisa dibatalkan.`)) return;
    try { await removeTask(task.id); await refresh(); announceTaskChange(); feedback = 'Tugas dihapus.'; }
    catch { error = 'Tugas gagal dihapus. Coba lagi.'; }
  }
  function handleEscape(event: KeyboardEvent) { if (event.key === 'Escape') showForm = false; }
  function handleDialogKeydown(event: KeyboardEvent) { if (event.key === 'Escape') showForm = false; }
  onMount(() => {
    void refresh();
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') { openCreate(); history.replaceState({}, '', location.pathname); }
    const editId = params.get('edit');
    if (editId) void getTasks().then((items) => { const match = items.find((item) => item.id === editId); if (match) openEdit(match); });
    const requestedBucket = params.get('bucket');
    if (requestedBucket && ['overdue', 'today', 'tomorrow', 'week', 'later'].includes(requestedBucket)) bucket = requestedBucket;
    if (params.get('new') === '1' || editId || requestedBucket) history.replaceState({}, '', location.pathname);
    const handle = () => void refresh();
    window.addEventListener('taskpulse:tasks-changed', handle);
    window.addEventListener('keydown', handleEscape);
    return () => { window.removeEventListener('taskpulse:tasks-changed', handle); window.removeEventListener('keydown', handleEscape); };
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(location.search);
    const requestedBucket = params.get('bucket');
    if (requestedBucket && ['overdue', 'today', 'tomorrow', 'week', 'later'].includes(requestedBucket)) bucket = requestedBucket;
  });
</script>

<section class="task-area" aria-label="Daftar tugas">
  <div class="toolbar">
    <label class="search"><span class="sr-only">Cari tugas</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input bind:value={query} type="search" placeholder="Cari tugas" /></label>
    <button class="primary add-button" type="button" onclick={openCreate}>Tambah tugas <span aria-hidden="true">+</span></button>
  </div>
  <div class="filters" aria-label="Filter daftar tugas">
    <label><span class="sr-only">Filter tanggal</span><select bind:value={bucket}><option value="all">Semua tanggal</option><option value="overdue">Terlambat</option><option value="today">Hari ini</option><option value="tomorrow">Besok</option><option value="week">Minggu ini</option><option value="later">Nanti</option></select></label>
    <label><span class="sr-only">Filter prioritas</span><select bind:value={priority}><option value="all">Semua prioritas</option><option value="high">Tinggi</option><option value="medium">Sedang</option><option value="low">Rendah</option></select></label>
  </div>
  {#if feedback}<p class="feedback" role="status">{feedback}</p>{/if}
  {#if error}<div class="notice error" role="alert"><span>{error}</span><button type="button" onclick={() => void refresh()}>Coba lagi</button></div>{/if}
  {#if loading}<p class="state-message" role="status">Memuat daftar tugas…</p>
  {:else if filtered.length === 0}
    <div class="empty-state"><div class="empty-mark" aria-hidden="true">—</div><h2>{tasks.length === 0 ? 'Belum ada tugas' : 'Tidak ada tugas yang cocok'}</h2><p>{tasks.length === 0 ? 'Tambahkan tugas pertamamu agar tanggal penting tidak terlewat.' : 'Coba ubah kata pencarian atau filter tanggal dan prioritas.'}</p>{#if tasks.length === 0}<button class="primary" type="button" onclick={openCreate}>Tambah tugas</button>{:else}<button class="quiet-button" type="button" onclick={() => { query = ''; bucket = 'all'; priority = 'all'; }}>Reset filter</button>{/if}</div>
  {:else}
    <ul class="task-list">
      {#each filtered as task (task.id)}
        <li class:done={task.status === 'done'} class="task-row">
          <button class="check-button" type="button" aria-label={task.status === 'done' ? `Tandai ${task.title} belum selesai` : `Tandai ${task.title} selesai`} onclick={() => void toggleDone(task)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>
          <a class="task-main" href={`/tasks/detail?id=${encodeURIComponent(task.id)}`}>
            <span class="task-title">{task.title}</span>
            <span class="task-meta">{#if task.category}<span>{task.category}</span><span aria-hidden="true">·</span>{/if}<span>{formatDueDate(task)}</span></span>
          </a>
          <div class="task-end"><span class="status" class:overdue={task.status === 'pending' && dueBucket(task.dueDate) === 'overdue'} class:today={task.status === 'pending' && dueBucket(task.dueDate) === 'today'} class:complete={task.status === 'done'}><span class="status-dot" aria-hidden="true"></span>{dueLabel(task)}</span><span class="priority-mark" class:high={task.priority === 'high'} class:medium={task.priority === 'medium'} title={`Prioritas ${task.priority === 'high' ? 'tinggi' : task.priority === 'medium' ? 'sedang' : 'rendah'}`}>{task.priority === 'high' ? 'Tinggi' : task.priority === 'medium' ? 'Sedang' : 'Rendah'}</span></div>
          <div class="row-actions"><button class="icon-button" type="button" aria-label={`Edit ${task.title}`} onclick={() => openEdit(task)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4-.8L19.2 8a2.1 2.1 0 0 0-3-3L5 16.2 4 20z"/></svg></button><button class="icon-button delete" type="button" aria-label={`Hapus ${task.title}`} onclick={() => void deleteTask(task)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></button></div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

{#if showForm}
  <div class="dialog-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) showForm = false; }} onkeydown={handleDialogKeydown}>
    <dialog class="task-dialog" open aria-labelledby="form-title">
      <div class="dialog-heading"><h2 id="form-title">{editingId ? 'Ubah tugas' : 'Tugas baru'}</h2><button class="icon-button close-button" type="button" aria-label="Tutup formulir" onclick={() => showForm = false}>×</button></div>
      <form onsubmit={submit}>
        <label class="field">Nama tugas <span aria-hidden="true">*</span><input bind:value={title} maxlength="120" required placeholder="Contoh: Kumpulkan laporan" /></label>
        <label class="field">Catatan <span class="optional">(opsional)</span><textarea bind:value={description} rows="3" maxlength="1000" placeholder="Tambahkan detail jika diperlukan"></textarea></label>
        <div class="field-grid"><label class="field">Tanggal deadline <span aria-hidden="true">*</span><input bind:value={dueDate} type="date" required /></label><label class="field">Waktu <span class="optional">(opsional)</span><input bind:value={dueTime} type="time" /></label></div>
        <div class="field-grid"><label class="field">Prioritas<select bind:value={taskPriority}><option value="high">Tinggi</option><option value="medium">Sedang</option><option value="low">Rendah</option></select></label><label class="field">Kategori <span class="optional">(opsional)</span><input bind:value={category} maxlength="40" placeholder="Kuliah, kerja…" /></label></div>
        <label class="notify-check"><input bind:checked={notify} type="checkbox" /><span><strong>Ingatkan di perangkat ini</strong><small>Pengingat hanya berfungsi saat aplikasi terbuka.</small></span></label>
        <p class="form-note">Tugas tersimpan di perangkat ini. Ekspor salinan dari Pengaturan agar data tetap aman.</p>
        <div class="form-actions"><button class="quiet-button" type="button" onclick={() => { showForm = false; clearForm(); }}>Batal</button><button class="primary" type="submit" disabled={saving}>{saving ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Simpan tugas'}</button></div>
      </form>
    </dialog>
  </div>
{/if}

<style>
  .task-area { display: grid; gap: 16px; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 10px; }
  .search { display: flex; align-items: center; gap: 9px; flex: 1 1 210px; min-height: 46px; padding: 0 12px; border: 1px solid #DAD5C7; border-radius: 10px; background: #FFFDF8; }
  .search svg { width: 19px; height: 19px; flex: 0 0 auto; fill: none; stroke: #6B675C; stroke-width: 1.7; stroke-linecap: round; }
  .search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #1C1B18; }
  .primary,.quiet-button { min-height: 44px; padding: 0 15px; border: 1px solid transparent; border-radius: 10px; cursor: pointer; font-weight: 650; }
  .primary { background: #9A3B1B; color: #FFFDF8; }.primary:hover { background: #7F2F16; }.primary:disabled { opacity: .6; cursor: wait; }
  .add-button { display: flex; align-items: center; justify-content: center; gap: 10px; white-space: nowrap; }.add-button span { font-size: 1.25rem; line-height: 1; }
  .quiet-button { background: transparent; border-color: #DAD5C7; color: #1C1B18; }.quiet-button:hover { background: #ECE9E0; }
  .filters { display: flex; flex-wrap: wrap; gap: 9px; }
  .filters select,.field input,.field select,.field textarea { min-height: 44px; width: 100%; padding: 9px 11px; border: 1px solid #DAD5C7; border-radius: 6px; background: #FFFDF8; color: #1C1B18; }
  .filters select { width: auto; min-width: 145px; }
  .feedback { margin: 0; color: #4F6B4A; font-size: .88rem; }
  .notice { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; padding: 12px; border: 1px solid #DAD5C7; border-radius: 10px; background: #FFFDF8; }.notice.error { color: #A32017; }
  .notice button { min-height: 40px; border: 0; background: transparent; color: #9A3B1B; font-weight: 650; cursor: pointer; }
  .state-message { margin: 4px 0; padding: 18px 0; color: #55524A; }
  .empty-state { padding: 32px 20px; border: 1px dashed #DAD5C7; border-radius: 10px; text-align: center; }
  .empty-mark { color: #9A3B1B; font-size: 1.6rem; }.empty-state h2 { margin: 8px 0 5px; font-size: 1.1rem; }.empty-state p { max-width: 38ch; margin: 0 auto 16px; color: #55524A; }
  .task-list { display: grid; gap: 9px; padding: 0; margin: 0; list-style: none; }
  .task-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: 8px 7px; padding: 10px 8px; border: 1px solid #DAD5C7; border-radius: 10px; background: #FFFDF8; }
  .check-button,.icon-button { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 8px; background: transparent; color: #6B675C; cursor: pointer; }
  .check-button { border: 1.5px solid #6B675C; border-radius: 50%; width: 23px; height: 23px; justify-self: center; }
  .check-button svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: 0; }
  .done .check-button { border-color: #4F6B4A; background: #4F6B4A; color: white; }.done .check-button svg { opacity: 1; }
  .task-main { min-width: 0; display: grid; gap: 3px; text-decoration: none; }.task-title { overflow-wrap: anywhere; font-weight: 620; line-height: 1.35; }.done .task-title { color: #6B675C; text-decoration: line-through; }
  .task-meta { display: flex; flex-wrap: wrap; gap: 5px; color: #55524A; font-size: .77rem; }.task-end { grid-column: 2 / 4; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 7px 0 0; }
  .status { display: inline-flex; align-items: center; gap: 6px; color: #55524A; font-size: .75rem; }.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #6B675C; }.status.overdue { color: #A32017; }.status.overdue .status-dot { background: #A32017; }.status.today { color: #8A5A00; }.status.today .status-dot { background: #8A5A00; }.status.complete { color: #4F6B4A; }.status.complete .status-dot { background: #4F6B4A; }
  .priority-mark { color: #6B675C; font-size: .72rem; }.priority-mark.high { color: #A32017; font-weight: 600; }.priority-mark.medium { color: #8A5A00; }
  .row-actions { grid-column: 1 / 4; display: flex; justify-content: flex-end; gap: 4px; border-top: 1px solid #ECE9E0; padding-top: 3px; }.icon-button svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; }.icon-button:hover { background: #ECE9E0; color: #1C1B18; }.icon-button.delete:hover { color: #A32017; }
  .dialog-backdrop { position: fixed; z-index: 10; inset: 0; display: grid; align-items: end; justify-items: center; padding: 0; background: #17161366; }
  .task-dialog { width: 100%; max-width: 580px; max-height: min(92dvh, 820px); overflow-y: auto; padding: 20px 18px calc(20px + env(safe-area-inset-bottom)); border: 1px solid #DAD5C7; border-radius: 14px 14px 0 0; background: #FFFDF8; box-shadow: 0 4px 24px #1c1b181a; }
  .dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }.dialog-heading h2 { margin: 0; font-size: 1.25rem; }.close-button { font-size: 1.6rem; }
  .task-dialog form { display: grid; gap: 13px; }.field { display: grid; gap: 6px; color: #1C1B18; font-size: .88rem; font-weight: 600; }.field > span:first-child { color: #9A3B1B; }.field .optional { display: inline; color: #6B675C; font-size: .78rem; font-weight: 400; }.field textarea { resize: vertical; min-height: 82px; }.field-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  .notify-check { display: flex; align-items: flex-start; gap: 11px; padding: 11px 0; cursor: pointer; }.notify-check input { width: 20px; height: 20px; margin: 1px 0; accent-color: #9A3B1B; }.notify-check span { display: grid; gap: 2px; }.notify-check strong { font-size: .88rem; }.notify-check small,.form-note { color: #55524A; font-size: .78rem; }.form-note { margin: 0; }.form-actions { display: flex; justify-content: flex-end; gap: 9px; padding-top: 5px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  :global(.dark) .search,:global(.dark) .filters select,:global(.dark) .field input,:global(.dark) .field select,:global(.dark) .field textarea,:global(.dark) .task-row,:global(.dark) .notice,:global(.dark) .task-dialog { background: #201F1A; border-color: #34322B; color: #F0EDE3; }
  :global(.dark) .search input,:global(.dark) .field { color: #F0EDE3; }:global(.dark) .search svg,:global(.dark) .task-meta,:global(.dark) .status,:global(.dark) .priority-mark,:global(.dark) .state-message,:global(.dark) .empty-state p,:global(.dark) .notify-check small,:global(.dark) .form-note { color: #B5B0A2; }
  :global(.dark) .empty-state { border-color: #34322B; }:global(.dark) .empty-state h2,:global(.dark) .task-title { color: #F0EDE3; }:global(.dark) .done .task-title { color: #B5B0A2; }
  :global(.dark) .quiet-button { border-color: #34322B; color: #F0EDE3; }:global(.dark) .quiet-button:hover,:global(.dark) .icon-button:hover { background: #34322B; color: #F0EDE3; }
  :global(.dark) .feedback { color: #8FBF87; }:global(.dark) .status.overdue { color: #F0857A; }:global(.dark) .status.overdue .status-dot { background: #F0857A; }:global(.dark) .status.today { color: #E0AE5A; }:global(.dark) .status.today .status-dot { background: #E0AE5A; }:global(.dark) .status.complete { color: #8FBF87; }:global(.dark) .status.complete .status-dot { background: #8FBF87; }
  :global(.dark) .primary { background: #E0764B; color: #171613; }:global(.dark) .primary:hover { background: #F08B62; }:global(.dark) .row-actions { border-color: #34322B; }
  @media (min-width: 620px) { .task-row { grid-template-columns: 42px minmax(0,1fr) auto auto; padding: 10px 12px; }.task-end { grid-column: auto; min-width: 100px; justify-content: flex-end; flex-direction: column; align-items: flex-end; gap: 2px; padding: 0; }.row-actions { grid-column: auto; border-top: 0; border-left: 1px solid #ECE9E0; padding: 0 0 0 5px; }.dialog-backdrop { align-items: center; padding: 20px; }.task-dialog { border-radius: 14px; padding: 22px; } }
  @media (max-width: 430px) { .field-grid { grid-template-columns: 1fr; }.add-button { flex: 1 0 100%; }.task-row { gap: 7px 5px; }.task-end { gap: 5px; }.status { font-size: .7rem; } }
</style>
