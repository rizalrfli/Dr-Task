import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ActivityEvent } from './activity';
import type { Task } from './types';

/** Metadata sinkronisasi, dipisah dari Task agar bentuk Task tetap murni. */
export interface SyncState {
  id: string;
  pending: boolean;
  updatedAt: string;
  deletedAt?: string;
}

interface TaskPulseDB extends DBSchema {
  tasks: {
    key: string;
    value: Task;
    indexes: { byDueDate: string; byStatus: string; byPriority: string };
  };
  sync: {
    key: string;
    value: SyncState;
    indexes: { byPending: number };
  };
  activity_outbox: {
    key: number;
    value: ActivityEvent & { localId?: number };
  };
}

let database: Promise<IDBPDatabase<TaskPulseDB>> | undefined;
function db() {
  database ??= openDB<TaskPulseDB>('taskpulse-db', 2, {
    upgrade(handle, oldVersion) {
      if (oldVersion < 1) {
        const store = handle.createObjectStore('tasks', { keyPath: 'id' });
        store.createIndex('byDueDate', 'dueDate');
        store.createIndex('byStatus', 'status');
        store.createIndex('byPriority', 'priority');
      }
      if (oldVersion < 2) {
        const sync = handle.createObjectStore('sync', { keyPath: 'id' });
        sync.createIndex('byPending', 'pending');
        handle.createObjectStore('activity_outbox', { keyPath: 'localId', autoIncrement: true });
      }
    }
  });
  return database;
}

export async function getTasks(): Promise<Task[]> {
  const handle = await db();
  const [tasks, sync] = await Promise.all([handle.getAll('tasks'), handle.getAll('sync')]);
  const removed = new Set(sync.filter((item) => item.deletedAt).map((item) => item.id));
  return tasks.filter((task) => !removed.has(task.id));
}

export async function getTask(id: string): Promise<Task | undefined> {
  return (await db()).get('tasks', id);
}

export async function saveTask(task: Task, options: { pending?: boolean } = {}): Promise<void> {
  const handle = await db();
  const tx = handle.transaction(['tasks', 'sync'], 'readwrite');
  await tx.objectStore('tasks').put(task);
  await tx.objectStore('sync').put({
    id: task.id,
    pending: options.pending ?? true,
    updatedAt: new Date().toISOString()
  });
  await tx.done;
}

export async function removeTask(id: string): Promise<void> {
  const handle = await db();
  const tx = handle.transaction(['tasks', 'sync'], 'readwrite');
  await tx.objectStore('tasks').delete(id);
  await tx.objectStore('sync').put({
    id,
    pending: true,
    updatedAt: new Date().toISOString(),
    deletedAt: new Date().toISOString()
  });
  await tx.done;
}

export async function replaceTasks(tasks: Task[]): Promise<void> {
  const handle = await db();
  const tx = handle.transaction(['tasks', 'sync'], 'readwrite');
  const taskStore = tx.objectStore('tasks');
  const syncStore = tx.objectStore('sync');
  await taskStore.clear();
  await syncStore.clear();
  const now = new Date().toISOString();
  for (const task of tasks) {
    await taskStore.put(task);
    await syncStore.put({ id: task.id, pending: true, updatedAt: now });
  }
  await tx.done;
}

export async function clearTasks(): Promise<void> {
  const handle = await db();
  const tx = handle.transaction(['tasks', 'sync'], 'readwrite');
  await tx.objectStore('tasks').clear();
  await tx.objectStore('sync').clear();
  await tx.done;
}

/** Semua perubahan lokal yang belum terkirim ke server, termasuk tombstone. */
export async function getPendingChanges(): Promise<Array<{ state: SyncState; task?: Task }>> {
  const handle = await db();
  const pending = (await handle.getAll('sync')).filter((item) => item.pending);
  const result: Array<{ state: SyncState; task?: Task }> = [];
  for (const state of pending) {
    const task = state.deletedAt ? undefined : await handle.get('tasks', state.id);
    result.push({ state, task });
  }
  return result;
}

export async function markSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const handle = await db();
  const tx = handle.transaction('sync', 'readwrite');
  for (const id of ids) {
    const state = await tx.store.get(id);
    if (state) await tx.store.put({ ...state, pending: false });
  }
  await tx.done;
}

/** Terapkan tugas dari server tanpa menandainya perlu dikirim balik. */
export async function applyRemoteTasks(tasks: Task[]): Promise<void> {
  const handle = await db();
  const tx = handle.transaction(['tasks', 'sync'], 'readwrite');
  for (const task of tasks) {
    const local = await tx.objectStore('sync').get(task.id);
    if (local?.pending) continue; // perubahan lokal belum terkirim, jangan ditimpa
    await tx.objectStore('tasks').put(task);
    await tx.objectStore('sync').put({ id: task.id, pending: false, updatedAt: new Date().toISOString() });
  }
  await tx.done;
}

/** Terapkan penghapusan dari server (tombstone) tanpa mengirim balik. */
export async function applyRemoteDeletes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const handle = await db();
  const tx = handle.transaction(['tasks', 'sync'], 'readwrite');
  for (const id of ids) {
    const local = await tx.objectStore('sync').get(id);
    if (local?.pending) continue;
    await tx.objectStore('tasks').delete(id);
    await tx.objectStore('sync').delete(id);
  }
  await tx.done;
}

/** Tandai semua tugas lokal untuk dikirim. Dipakai sekali saat login pertama di perangkat lama. */
export async function markAllPending(): Promise<number> {
  const handle = await db();
  const tx = handle.transaction(['tasks', 'sync'], 'readwrite');
  const tasks = await tx.objectStore('tasks').getAll();
  const now = new Date().toISOString();
  let count = 0;
  for (const task of tasks) {
    const existing = await tx.objectStore('sync').get(task.id);
    if (existing) continue;
    await tx.objectStore('sync').put({ id: task.id, pending: true, updatedAt: now });
    count += 1;
  }
  await tx.done;
  return count;
}

export async function queueActivity(event: ActivityEvent): Promise<void> {
  await (await db()).add('activity_outbox', event);
}

export async function takeQueuedActivity(): Promise<Array<ActivityEvent & { localId: number }>> {
  const handle = await db();
  return (await handle.getAll('activity_outbox')) as Array<ActivityEvent & { localId: number }>;
}

export async function clearQueuedActivity(localIds: number[]): Promise<void> {
  if (localIds.length === 0) return;
  const handle = await db();
  const tx = handle.transaction('activity_outbox', 'readwrite');
  for (const id of localIds) await tx.store.delete(id);
  await tx.done;
}
