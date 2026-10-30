<script lang="ts">
  import { onMount } from 'svelte';
  import { addMonths, format, getDay, getDaysInMonth, isSameDay, parseISO, startOfMonth, subMonths } from 'date-fns';
  import { id } from 'date-fns/locale';
  import { getTasks } from '../../lib/db';
  import type { Task } from '../../lib/types';
  let tasks = $state<Task[]>([]);
  let loading = $state(true);
  let error = $state(false);
  let month = $state(startOfMonth(new Date()));
  let selected = $state(new Date());
  const days = $derived(Array.from({ length: getDaysInMonth(month) }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)));
  const offset = $derived((getDay(startOfMonth(month)) + 6) % 7);
  const selectedTasks = $derived(tasks.filter((task) => isSameDay(parseISO(task.dueDate), selected)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? '').localeCompare(b.dueTime ?? '')));
  const today = new Date();
  async function load() { loading = true; error = false; try { tasks = await getTasks(); } catch { error = true; } finally { loading = false; } }
  function moveMonth(amount: number) { month = amount > 0 ? addMonths(month, amount) : subMonths(month, -amount); selected = new Date(month.getFullYear(), month.getMonth(), 1); }
  function dateTasks(date: Date) { return tasks.filter((task) => isSameDay(parseISO(task.dueDate), date)); }
  onMount(() => { void load(); const handle = () => void load(); window.addEventListener('taskpulse:tasks-changed', handle); return () => window.removeEventListener('taskpulse:tasks-changed', handle); });
</script>

<section class="calendar-wrap" aria-label="Kalender deadline">
  <div class="month-head"><button class="month-button" type="button" aria-label="Bulan sebelumnya" onclick={() => moveMonth(-1)}>‹</button><h2 aria-live="polite">{format(month, 'MMMM yyyy', { locale: id })}</h2><button class="month-button" type="button" aria-label="Bulan berikutnya" onclick={() => moveMonth(1)}>›</button></div>
  {#if loading}<p class="state" role="status">Memuat kalender…</p>{:else if error}<div class="state error" role="alert"><p>Kalender gagal dimuat.</p><button onclick={() => void load()}>Coba lagi</button></div>{:else}
    <div class="calendar-grid" role="grid" aria-label={format(month, 'MMMM yyyy', { locale: id })}>
      {#each ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as day}<div class="weekday" role="columnheader">{day}</div>{/each}
      {#each Array.from({ length: offset }) as _, index}<div class="blank" aria-hidden="true" data-index={index}></div>{/each}
      {#each days as day (day.toISOString())}
        {@const dayTasks = dateTasks(day)}
        <button class="day" class:selected={isSameDay(day, selected)} class:isToday={isSameDay(day, today)} type="button" role="gridcell" aria-label={`${format(day, 'EEEE d MMMM', { locale: id })}${dayTasks.length ? `, ${dayTasks.length} tugas` : ', tidak ada tugas'}`} aria-selected={isSameDay(day, selected)} onclick={() => selected = day}>
          <span class="day-number">{format(day, 'd')}</span>{#if dayTasks.length}<span class="task-count" aria-hidden="true">{dayTasks.length > 9 ? '9+' : dayTasks.length}</span>{/if}
        </button>
      {/each}
    </div>
    <section class="day-agenda" aria-live="polite"><div class="agenda-heading"><h3>{format(selected, 'EEEE, d MMMM', { locale: id })}</h3><span>{selectedTasks.length ? `${selectedTasks.length} tugas` : 'Kosong'}</span></div>
      {#if selectedTasks.length}<ul>{#each selectedTasks as task}<li><a href={`/tasks/detail?id=${encodeURIComponent(task.id)}`}><span class="agenda-title">{task.title}</span><span class="agenda-meta">{task.dueTime ?? 'Sepanjang hari'}{task.category ? ` · ${task.category}` : ''}{task.status === 'done' ? ' · Selesai' : ''}</span></a></li>{/each}</ul>
      {:else}<p class="empty-day">Tidak ada deadline di tanggal ini. <a href="/tasks?new=1">Tambah tugas</a></p>{/if}
    </section>
  {/if}
</section>

<style>
  .calendar-wrap { display: grid; gap: 18px; }.month-head { display: flex; align-items: center; justify-content: space-between; }.month-head h2 { margin: 0; font-size: 1.12rem; text-transform: capitalize; }.month-button { width: 44px; height: 44px; border: 1px solid #DAD5C7; border-radius: 8px; background: #FFFDF8; color: #1C1B18; font-size: 1.5rem; cursor: pointer; }.calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }.weekday { display: grid; place-items: center; min-height: 32px; color: #55524A; font-size: .73rem; font-weight: 600; }.day,.blank { min-width: 0; min-height: clamp(43px, 12vw, 62px); }.day { position: relative; display: grid; align-content: start; justify-items: center; gap: 2px; padding: 6px 1px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: #1C1B18; cursor: pointer; }.day:hover { background: #ECE9E0; }.day.selected { border-color: #9A3B1B; background: #FFFDF8; }.day.isToday .day-number { color: #9A3B1B; font-weight: 750; text-decoration: underline; text-underline-offset: 3px; }.day-number { font-variant-numeric: tabular-nums; }.task-count { min-width: 20px; padding: 0 4px; border-radius: 4px; background: #ECE9E0; color: #55524A; font-size: .65rem; line-height: 1.35; font-variant-numeric: tabular-nums; }.day-agenda { padding-top: 15px; border-top: 1px solid #DAD5C7; }.agenda-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }.agenda-heading h3 { margin: 0; font-size: 1rem; text-transform: capitalize; }.agenda-heading span { color: #55524A; font-size: .78rem; }.day-agenda ul { padding: 0; margin: 9px 0 0; list-style: none; }.day-agenda li { border-top: 1px solid #DAD5C7; }.day-agenda li a { min-height: 58px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; text-decoration: none; }.agenda-title { overflow-wrap: anywhere; font-weight: 600; }.agenda-meta,.empty-day,.state { color: #55524A; font-size: .8rem; }.empty-day { margin: 12px 0; }.empty-day a { color: #9A3B1B; }.state { padding: 14px 0; }.error button { min-height: 40px; color: #9A3B1B; background: none; border: 0; cursor: pointer; }
  :global(.dark) .month-button { background: #201F1A; border-color: #34322B; color: #F0EDE3; }:global(.dark) .weekday,:global(.dark) .agenda-heading span,:global(.dark) .agenda-meta,:global(.dark) .empty-day,:global(.dark) .state { color: #B5B0A2; }:global(.dark) .day { color: #F0EDE3; }:global(.dark) .day:hover,:global(.dark) .task-count { background: #34322B; color: #F0EDE3; }:global(.dark) .day.selected { border-color: #E0764B; background: #201F1A; }:global(.dark) .day.isToday .day-number,:global(.dark) .empty-day a { color: #E0764B; }:global(.dark) .day-agenda,:global(.dark) .day-agenda li { border-color: #34322B; }
</style>
