import { describe, expect, it } from 'vitest';
import { compareTasks, dueBucket, dueLabel } from './dates';
import type { Task } from './types';
const base: Task = { id: 'a', title: 'Tugas', dueDate: '2026-10-30', priority: 'medium', status: 'pending', notify: false, createdAt: '2026-10-01T00:00:00Z' };
describe('dueBucket', () => {
  const today = new Date(2026, 9, 30, 12);
  it('classifies dates around today', () => {
    expect(dueBucket('2026-10-29', today)).toBe('overdue');
    expect(dueBucket('2026-10-30', today)).toBe('today');
    expect(dueBucket('2026-10-31', today)).toBe('tomorrow');
    expect(dueBucket('2026-11-03', today)).toBe('week');
    expect(dueBucket('2026-11-10', today)).toBe('later');
  });
  it('labels done tasks as complete', () => expect(dueLabel({ ...base, status: 'done' }, today)).toBe('Selesai'));
});
describe('compareTasks', () => {
  it('sorts by date, then priority', () => {
    const high = { ...base, id: 'high', priority: 'high' as const };
    expect(compareTasks(high, base)).toBeLessThan(0);
  });
});
