import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { clearTasks, getTask, getTasks, removeTask, saveTask } from './db';
import type { Task } from './types';
const sample: Task = { id: 'test-1', title: 'Baca bab 4', dueDate: '2026-11-05', priority: 'high', status: 'pending', notify: false, createdAt: '2026-10-30T00:00:00.000Z' };
afterEach(async () => clearTasks());
describe('task database', () => {
  it('creates and reads a task', async () => { await saveTask(sample); expect(await getTask(sample.id)).toEqual(sample); });
  it('updates existing tasks', async () => { await saveTask(sample); await saveTask({ ...sample, title: 'Revisi bab 4' }); expect((await getTasks())[0]?.title).toBe('Revisi bab 4'); });
  it('removes a task', async () => { await saveTask(sample); await removeTask(sample.id); expect(await getTasks()).toEqual([]); });
});
