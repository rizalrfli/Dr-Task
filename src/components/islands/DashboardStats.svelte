<script lang="ts">
  import { onMount } from 'svelte';
  import { compareTasks, formatDueDate } from '../../lib/dates';
  import { getTasks } from '../../lib/db';
  import type { Task } from '../../lib/types';
  let tasks = $state<Task[]>([]);
  let loading = $state(true);
  let failed = $state(false);
  const pending = $derived(tasks.filter((task) => task.status === 'pending'));
  function relativeBucket(task: Task) { const diff = Math.round((new Date(`${task.dueDate}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000); return diff < 0 ? 'overdue' : diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff <= 7 ? 'week' : 'later'; }
  const overdue = $derived(pending.filter((task) => relativeBucket(task) === 'overdue').sort(compareTasks));
  const dueToday = $derived(pending.filter((task) => relativeBucket(task) === 'today').sort(compareTasks));
  const coming = $derived(pending.filter((task) => relativeBucket(task) !== 'overdue' && relativeBucket(task) !== 'today').sort(compareTasks).slice(0, 4));
  async function refresh() { loading = true; failed = false; try { tasks = await getTasks(); } catch { failed = true; } finally { loading = false; } }
  onMount(() => { void refresh(); const handle = () => void refresh(); window.addEventListener('taskpulse:tasks-changed', handle); return () => window.removeEventListener('taskpulse:tasks-changed', handle); });
</script>

<div class="dashboard">
  {#if loading}<p role="status" class="loading">Memuat tugas…</p>
  {:else if failed}<div class="callout error" role="alert"><p>Ringkasan tidak bisa dimuat. Coba buka kembali halaman ini.</p><button onclick={() => void refresh()}>Coba lagi</button></div>
  {:else}
    <section class="focus-block" aria-labelledby="focus-title">
      <div class="focus-copy"><p class="eyebrow">Fokus hari ini</p><h2 id="focus-title">{dueToday.length ? `${dueToday.length} tugas perlu perhatian` : overdue.length ? 'Rapikan yang tertunda' : 'Hari ini lebih lapang'}</h2><p>{overdue.length ? `${overdue.length} tugas sudah melewati deadline.` : dueToday.length ? 'Lihat tenggat terdekat dan mulai dari satu hal.' : 'Belum ada deadline untuk hari ini.'}</p></div>
      <a href={overdue.length ? '/tasks?bucket=overdue' : '/tasks?bucket=today'} class="focus-link">{overdue.length ? 'Lihat yang terlambat' : 'Lihat tugas hari ini'}</a>
    </section>
    <section class="count-strip" aria-label="Ringkasan tugas"><div><span class="count">{pending.length}</span><span>Belum selesai</span></div><div><span class="count overdue-count">{overdue.length}</span><span>Terlambat</span></div><div><span class="count today-count">{dueToday.length}</span><span>Hari ini</span></div><div><span class="count done-count">{tasks.filter((task) => task.status === 'done').length}</span><span>Selesai</span></div></section>
    {#if overdue.length}<section class="task-section"><div class="section-heading"><h2>Terlambat</h2><a href="/tasks?bucket=overdue">Lihat semua</a></div><ul>{#each overdue.slice(0, 3) as task}<li><a href={`/tasks/detail?id=${encodeURIComponent(task.id)}`}><span>{task.title}</span><time>{formatDueDate(task)}</time></a></li>{/each}</ul></section>{/if}
    <section class="task-section"><div class="section-heading"><h2>{dueToday.length ? 'Untuk hari ini' : overdue.length ? 'Berikutnya' : 'Agenda terdekat'}</h2><a href="/tasks">Semua tugas</a></div>
      {#if dueToday.length}<ul>{#each dueToday.slice(0, 4) as task}<li><a href={`/tasks/detail?id=${encodeURIComponent(task.id)}`}><span>{task.title}</span><time>{task.dueTime ?? 'Hari ini'}{task.category ? ` · ${task.category}` : ''}</time></a></li>{/each}</ul>
      {:else if coming.length}<ul>{#each coming as task}<li><a href={`/tasks/detail?id=${encodeURIComponent(task.id)}`}><span>{task.title}</span><time>{formatDueDate(task)}</time></a></li>{/each}</ul>
      {:else if !overdue.length && pending.length === 0}<div class="empty-agenda"><p>{tasks.length ? 'Semua tugas sudah selesai.' : 'Belum ada tugas tersimpan.'}</p><a href="/tasks?new=1">Tambah tugas pertama</a></div>{/if}
    </section>
  {/if}
  <aside class="privacy-note"><span>Data tugas tersimpan di perangkat ini.</span><a href="/settings">Buat salinan cadangan</a></aside>
</div>

<style>
  .dashboard { display: grid; gap: 25px; }.loading { color: #55524A; }.focus-block { display: flex; align-items: end; justify-content: space-between; gap: 18px; padding: 19px 0 21px; border-bottom: 1px solid #DAD5C7; }.eyebrow { margin: 0 0 8px; color: #9A3B1B; font-size: .75rem; font-weight: 650; }.focus-copy h2 { max-width: 22ch; margin: 0; font-size: clamp(1.25rem, 5vw, 1.65rem); line-height: 1.25; letter-spacing: -.025em; }.focus-copy p:last-child { margin: 7px 0 0; color: #55524A; }.focus-link { flex: 0 0 auto; min-height: 44px; display: flex; align-items: center; color: #9A3B1B; font-weight: 650; text-decoration-thickness: 1px; text-underline-offset: 3px; }
  .count-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-bottom: 1px solid #DAD5C7; padding: 0 0 17px; }.count-strip div { display: grid; gap: 2px; padding-left: 12px; border-left: 1px solid #DAD5C7; color: #55524A; font-size: .75rem; }.count-strip div:first-child { border: 0; padding-left: 0; }.count { color: #1C1B18; font-size: 1.4rem; font-weight: 650; font-variant-numeric: tabular-nums; }.overdue-count { color: #A32017; }.today-count { color: #8A5A00; }.done-count { color: #4F6B4A; }
  .task-section { display: grid; gap: 9px; }.section-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }.section-heading h2 { margin: 0; font-size: 1.06rem; }.section-heading a,.empty-agenda a { color: #9A3B1B; font-size: .83rem; font-weight: 600; text-underline-offset: 3px; }.task-section ul { list-style: none; padding: 0; margin: 0; border-top: 1px solid #DAD5C7; }.task-section li { border-bottom: 1px solid #DAD5C7; }.task-section li a { min-height: 57px; display: flex; justify-content: space-between; align-items: center; gap: 15px; text-decoration: none; }.task-section li a span { min-width: 0; overflow-wrap: anywhere; font-weight: 570; }.task-section time { flex: 0 0 auto; color: #55524A; font-size: .78rem; }.empty-agenda { padding: 14px 0; color: #55524A; }.empty-agenda p { margin: 0 0 5px; }.privacy-note { display: flex; flex-wrap: wrap; gap: 4px 8px; padding-top: 14px; border-top: 1px solid #DAD5C7; color: #6B675C; font-size: .78rem; }.privacy-note a { color: #55524A; text-underline-offset: 3px; }.callout { padding: 12px; border: 1px solid #DAD5C7; border-radius: 10px; }.callout p { margin: 0 0 8px; }.callout button { min-height: 40px; border: 0; background: transparent; color: #9A3B1B; font-weight: 650; }
  :global(.dark) .focus-block,:global(.dark) .count-strip,:global(.dark) .task-section ul,:global(.dark) .task-section li,:global(.dark) .privacy-note,:global(.dark) .count-strip div { border-color: #34322B; }
  :global(.dark) .focus-copy p:last-child,:global(.dark) .count-strip div,:global(.dark) .task-section time,:global(.dark) .privacy-note,:global(.dark) .empty-agenda { color: #B5B0A2; }:global(.dark) .overdue-count { color: #F0857A; }:global(.dark) .today-count { color: #E0AE5A; }:global(.dark) .done-count { color: #8FBF87; }:global(.dark) .focus-link,:global(.dark) .section-heading a,:global(.dark) .empty-agenda a,:global(.dark) .privacy-note a { color: #E0764B; }:global(.dark) .count { color: #F0EDE3; }
  @media (max-width: 560px) { .focus-block { align-items: flex-start; flex-direction: column; gap: 8px; }.focus-link { min-height: 36px; }.count-strip div { padding-left: 8px; font-size: .67rem; }.count { font-size: 1.2rem; }.task-section li a { align-items: flex-start; flex-direction: column; justify-content: center; gap: 2px; padding: 8px 0; } }
</style>
