import type { Task } from './types';
import { replaceTasks } from './db';

export function exportTasks(tasks: Task[]) {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `taskpulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importTasks(file: File): Promise<number> {
  const parsed: unknown = JSON.parse(await file.text());
  const tasks = Array.isArray(parsed) ? parsed : (parsed as { tasks?: unknown })?.tasks;
  if (!Array.isArray(tasks) || !tasks.every(isTask)) throw new Error('File backup tidak memiliki format tugas yang valid.');
  await replaceTasks(tasks);
  return tasks.length;
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<Task>;
  return typeof task.id === 'string' && typeof task.title === 'string' && typeof task.dueDate === 'string'
    && ['low', 'medium', 'high'].includes(task.priority ?? '')
    && ['pending', 'done'].includes(task.status ?? '') && typeof task.createdAt === 'string'
    && typeof task.notify === 'boolean';
}
