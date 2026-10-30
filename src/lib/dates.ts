import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import type { DueBucket, Task } from './types';

export function dueBucket(date: string, today = new Date()): DueBucket {
  const delta = differenceInCalendarDays(parseISO(date), startOfDay(today));
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  if (delta === 1) return 'tomorrow';
  if (delta <= 7) return 'week';
  return 'later';
}

export function formatDueDate(task: Pick<Task, 'dueDate' | 'dueTime'>): string {
  const date = format(parseISO(task.dueDate), 'EEE, d MMM', { locale: id });
  return task.dueTime ? `${date} · ${task.dueTime}` : date;
}

export function compareTasks(a: Task, b: Task): number {
  const dateOrder = a.dueDate.localeCompare(b.dueDate);
  if (dateOrder) return dateOrder;
  const timeOrder = (a.dueTime ?? '23:59').localeCompare(b.dueTime ?? '23:59');
  if (timeOrder) return timeOrder;
  const rank = { high: 0, medium: 1, low: 2 };
  return rank[a.priority] - rank[b.priority];
}

export function dueLabel(task: Task, today = new Date()): string {
  if (task.status === 'done') return 'Selesai';
  const bucket = dueBucket(task.dueDate, today);
  if (bucket === 'overdue') return 'Terlambat';
  if (bucket === 'today') return 'Hari ini';
  if (bucket === 'tomorrow') return 'Besok';
  return formatDueDate(task).split(' · ')[0];
}
