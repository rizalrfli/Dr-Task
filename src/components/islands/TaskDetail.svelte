<script lang="ts">
  import { onMount } from 'svelte';
  import { dueBucket, dueLabel, formatDueDate } from '../../lib/dates';
  import { getTask, removeTask, saveTask } from '../../lib/db';
  import { logActivity } from '../../lib/activity';
  import { syncNow } from '../../lib/sync';
  import type { Task } from '../../lib/types';
  let task = $state<Task | undefined>();
  let loading = $state(true);
  let error = $state('');
  let notFound = $state(false);
  async function load() {
    loading = true; error = ''; notFound = false;
    try { const id = new URLSearchParams(location.search).get('id'); if (!id) { notFound = true; return; } task = await getTask(id); notFound = !task; }
    catch { error = 'Detail tugas tidak bisa dibuka. Coba lagi.'; }
    finally { loading = false; }
  }
  async function toggleDone() {
    if (!task) return;
    try {
      const nextStatus = task.status === 'done' ? 'pending' : 'done';
      const updated = { ...task, status: nextStatus, completedAt: nextStatus === 'done' ? new Date().toISOString() : undefined };
      await saveTask(updated);
      task = updated;
      window.dispatchEvent(new Event('taskpulse:tasks-changed'));
      void logActivity(nextStatus === 'done' ? 'task_completed' : 'task_reopened', { entityType: 'task', entityId: task.id });
      void syncNow().then(() => window.dispatchEvent(new Event('taskpulse:tasks-changed')));
    }
    catch { error = 'Perubahan status gagal disimpan.'; }
  }
  async function deleteTask() {
    if (!task || !confirm(`Hapus tugas “${task.title}”? Tindakan ini tidak bisa dibatalkan.`)) return;
    const removed = task;
    try {
      await removeTask(removed.id);
      window.dispatchEvent(new Event('taskpulse:tasks-changed'));
      void logActivity('task_deleted', { entityType: 'task', entityId: removed.id, metadata: { title: removed.title } });
      void syncNow();
      location.href = '/tasks';
    }
    catch { error = 'Tugas gagal dihapus. Coba lagi.'; }
  }
  onMount(() => { void load(); });
</script>

<section class="detail">
  {#if loading}<p role="status">Memuat detail tugas…</p>
  {:else if error}<div class="message error" role="alert"><p>{error}</p><button onclick={() => void load()}>Coba lagi</button></div>
  {:else if notFound || !task}<div class="message"><h2>Tugas tidak ditemukan</h2><p>Mungkin tugas sudah dihapus atau tautan tidak lengkap.</p><a href="/tasks">Kembali ke daftar tugas</a></div>
  {:else}
    <article class="detail-card"><div class="detail-top"><span class="status" class:overdue={task.status === 'pending' && dueBucket(task.dueDate) === 'overdue'} class:today={task.status === 'pending' && dueBucket(task.dueDate) === 'today'} class:complete={task.status === 'done'}>{dueLabel(task)}</span><span class="priority">Prioritas {task.priority === 'high' ? 'tinggi' : task.priority === 'medium' ? 'sedang' : 'rendah'}</span></div>
      <h2 class:done-title={task.status === 'done'}>{task.title}</h2>
      <dl><div><dt>Deadline</dt><dd>{formatDueDate(task)}</dd></div>{#if task.category}<div><dt>Kategori</dt><dd>{task.category}</dd></div>{/if}{#if task.description}<div class="description"><dt>Catatan</dt><dd>{task.description}</dd></div>{/if}{#if task.completedAt}<div><dt>Diselesaikan</dt><dd>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(task.completedAt))}</dd></div>{/if}</dl>
      <div class="actions"><button class="primary" onclick={() => void toggleDone()}>{task.status === 'done' ? 'Tandai belum selesai' : 'Tandai selesai'}</button><a class="secondary" href={`/tasks?edit=${encodeURIComponent(task.id)}`}>Ubah tugas</a><button class="delete" onclick={() => void deleteTask()}>Hapus</button></div>
    </article>
    <a class="back" href="/tasks">← Kembali ke semua tugas</a>
  {/if}
</section>

<style>
  .detail { display: grid; gap: 17px; }.detail-card { padding: 18px 0 8px; border-top: 1px solid #DAD5C7; }.detail-top { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }.status { color: #55524A; font-size: .8rem; font-weight: 650; }.status.overdue { color: #A32017; }.status.today { color: #8A5A00; }.status.complete { color: #4F6B4A; }.priority { color: #6B675C; font-size: .8rem; }.detail-card h2 { margin: 16px 0 20px; font-size: 1.5rem; line-height: 1.3; overflow-wrap: anywhere; }.done-title { color: #6B675C; text-decoration: line-through; }.detail-card dl { display: grid; gap: 0; margin: 0; }.detail-card dl div { display: grid; grid-template-columns: minmax(90px, 140px) minmax(0, 1fr); gap: 10px; padding: 12px 0; border-top: 1px solid #DAD5C7; }.detail-card dt { color: #55524A; font-size: .83rem; }.detail-card dd { margin: 0; overflow-wrap: anywhere; }.detail-card .description { align-items: start; }.description dd { white-space: pre-wrap; }.actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 22px; }.primary,.secondary,.delete { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border: 1px solid #DAD5C7; border-radius: 8px; background: #FFFDF8; color: #1C1B18; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }.primary { border-color: #9A3B1B; background: #9A3B1B; color: #FFFDF8; }.delete { color: #A32017; }.back { min-height: 44px; display: inline-flex; align-items: center; color: #9A3B1B; }.message { padding: 20px 0; }.message p { color: #55524A; }.message a,.message button { color: #9A3B1B; }.error { color: #A32017; }
  :global(.dark) .detail-card,:global(.dark) .detail-card dl div { border-color: #34322B; }:global(.dark) .priority,:global(.dark) .detail-card dt,:global(.dark) .message p { color: #B5B0A2; }:global(.dark) .status.overdue,:global(.dark) .error,:global(.dark) .delete { color: #F0857A; }:global(.dark) .status.today { color: #E0AE5A; }:global(.dark) .status.complete { color: #8FBF87; }:global(.dark) .primary { border-color: #E0764B; background: #E0764B; color: #171613; }:global(.dark) .secondary,:global(.dark) .delete { border-color: #34322B; background: #201F1A; color: #F0EDE3; }:global(.dark) .back,:global(.dark) .message a,:global(.dark) .message button { color: #E0764B; }
</style>
