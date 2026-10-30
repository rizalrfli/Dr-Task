import type { Task } from './types';
import {
  applyRemoteDeletes,
  applyRemoteTasks,
  getPendingChanges,
  markAllPending,
  markSynced
} from './db';
import { flushActivity } from './activity';
import { supabase } from './supabase';

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  priority: string;
  status: string;
  category: string | null;
  notify: boolean;
  created_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

function toRow(task: Task, userId: string) {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description ?? null,
    due_date: task.dueDate,
    due_time: task.dueTime ?? null,
    priority: task.priority,
    status: task.status,
    category: task.category ?? null,
    notify: task.notify,
    created_at: task.createdAt,
    completed_at: task.completedAt ?? null,
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

function fromRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date,
    dueTime: row.due_time ?? undefined,
    priority: row.priority as Task['priority'],
    status: row.status as Task['status'],
    category: row.category ?? undefined,
    notify: row.notify,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined
  };
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  removed: number;
  error?: string;
}

let running: Promise<SyncResult> | undefined;

async function userId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Kirim perubahan lokal lalu tarik perubahan dari server. Aman dipanggil berulang. */
export function syncNow(): Promise<SyncResult> {
  running ??= runSync().finally(() => { running = undefined; });
  return running;
}

async function runSync(): Promise<SyncResult> {
  const uid = await userId();
  const result: SyncResult = { pushed: 0, pulled: 0, removed: 0 };
  if (!uid) return result;

  // 1. Tugas lama (dibuat sebelum fitur sync ada) ikut dikirim pada kesempatan pertama.
  await markAllPending();

  // 2. Push: kirim semua perubahan lokal yang tertunda.
  const pending = await getPendingChanges();
  const upserts: ReturnType<typeof toRow>[] = [];
  const deletes: string[] = [];
  const doneIds: string[] = [];

  for (const { state, task } of pending) {
    if (state.deletedAt) deletes.push(state.id);
    else if (task) upserts.push(toRow(task, uid));
    doneIds.push(state.id);
  }

  if (upserts.length > 0) {
    const { error } = await supabase.from('tasks').upsert(upserts, { onConflict: 'id' });
    if (error) {
      result.error = error.message;
      return result;
    }
    result.pushed = upserts.length;
  }

  if (deletes.length > 0) {
    // Soft delete, bukan hard delete: perangkat lain perlu melihat tombstone
    // agar salinan lokal mereka ikut terhapus saat pull berikutnya.
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: now, updated_at: now })
      .in('id', deletes)
      .eq('user_id', uid);
    if (error) {
      result.error = error.message;
      return result;
    }
    result.pushed += deletes.length;
  }

  await markSynced(doneIds);

  // 3. Pull: ambil seluruh tugas milik user, termasuk tombstone.
  const { data, error } = await supabase
    .from('tasks')
    .select('id,title,description,due_date,due_time,priority,status,category,notify,created_at,completed_at,deleted_at')
    .eq('user_id', uid);

  if (error) {
    result.error = error.message;
    return result;
  }

  const rows = (data ?? []) as TaskRow[];
  const active = rows.filter((row) => !row.deleted_at).map(fromRow);
  const gone = rows.filter((row) => row.deleted_at).map((row) => row.id);

  await applyRemoteTasks(active);
  await applyRemoteDeletes(gone);
  result.pulled = active.length;
  result.removed = gone.length;

  await flushActivity();
  return result;
}

/** Sinkronisasi otomatis: saat online, saat app kembali terlihat, dan tiap 60 detik. */
export function startAutoSync(onChange?: (result: SyncResult) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let stopped = false;
  const run = () => {
    if (stopped || !navigator.onLine) return;
    void syncNow().then((result) => {
      if (result.pushed > 0 || result.pulled > 0 || result.removed > 0) onChange?.(result);
    });
  };

  run();
  const interval = window.setInterval(run, 60_000);
  const onVisible = () => { if (document.visibilityState === 'visible') run(); };
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    stopped = true;
    window.clearInterval(interval);
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
