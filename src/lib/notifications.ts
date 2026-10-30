import type { Task } from './types';
import { getTasks, removeTask } from './db';

function notifyIfAllowed(task: Task) {
  if (!task.notify || task.status === 'done' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => registration.showNotification('Deadline tugas', {
    body: `${task.title} · ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ''}`,
    icon: '/icons/icon-192.png', tag: `task-${task.id}`, data: { url: `/tasks/detail?id=${encodeURIComponent(task.id)}` }
  })).catch(() => undefined);
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

export function scheduleTaskReminder(task: Task, now = Date.now()) {
  if (!task.notify || task.status === 'done' || !task.dueDate) return () => undefined;
  const [year, month, day] = task.dueDate.split('-').map(Number);
  const [hour, minute] = (task.dueTime ?? '09:00').split(':').map(Number);
  const deadline = new Date(year!, month! - 1, day!, hour!, minute!).getTime();
  const delay = deadline - now;
  if (delay <= 0 || delay > 2_147_000_000) return () => undefined;
  const timer = window.setTimeout(() => notifyIfAllowed(task), delay);
  return () => window.clearTimeout(timer);
}

export async function notifyOverdueOnOpen() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const today = new Date().toLocaleDateString('sv-SE');
  const overdue = (await getTasks()).filter((task) => task.status === 'pending' && task.notify && task.dueDate < today);
  for (const task of overdue) notifyIfAllowed(task);
}

export async function deleteTaskAndReminder(id: string) {
  await removeTask(id);
}
