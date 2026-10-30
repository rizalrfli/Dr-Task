import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Task } from './types';

interface TaskPulseDB extends DBSchema {
  tasks: {
    key: string;
    value: Task;
    indexes: { byDueDate: string; byStatus: string; byPriority: string };
  };
}

let database: Promise<IDBPDatabase<TaskPulseDB>> | undefined;
function db() {
  database ??= openDB<TaskPulseDB>('taskpulse-db', 1, {
    upgrade(handle) {
      const store = handle.createObjectStore('tasks', { keyPath: 'id' });
      store.createIndex('byDueDate', 'dueDate');
      store.createIndex('byStatus', 'status');
      store.createIndex('byPriority', 'priority');
    }
  });
  return database;
}

export async function getTasks(): Promise<Task[]> {
  return (await db()).getAll('tasks');
}
export async function getTask(id: string): Promise<Task | undefined> {
  return (await db()).get('tasks', id);
}
export async function saveTask(task: Task): Promise<void> {
  await (await db()).put('tasks', task);
}
export async function removeTask(id: string): Promise<void> {
  await (await db()).delete('tasks', id);
}
export async function replaceTasks(tasks: Task[]): Promise<void> {
  const database = await db();
  const tx = database.transaction('tasks', 'readwrite');
  await tx.store.clear();
  for (const task of tasks) await tx.store.put(task);
  await tx.done;
}
export async function clearTasks(): Promise<void> {
  await (await db()).clear('tasks');
}
