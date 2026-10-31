import type { Task } from './types';
import { getTasks, removeTask } from './db';
import { playReminderSound } from './sound';

function pushHandlesReminders() {
  try { return localStorage.getItem('taskpulse:push-active') === '1'; } catch { return false; }
}

function notifyIfAllowed(task: Task) {
  if (!task.notify || task.status === 'done' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;
  if (pushHandlesReminders()) return;
  playReminderSound();
  const options = {
    body: `${task.title} · ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ''}`,
    icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: `task-${task.id}`,
    data: { url: `/tasks/detail?id=${encodeURIComponent(task.id)}` },
    silent: false, renotify: true, requireInteraction: true,
    vibrate: [600, 200, 600, 200, 600]
  } as NotificationOptions;
  navigator.serviceWorker.ready.then((registration) => registration.showNotification('Deadline tugas', options)).catch(() => undefined);
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

const reminderTimers = new Map<string, number>();

export function cancelTaskReminder(taskId: string) {
  const timer = reminderTimers.get(taskId);
  if (timer !== undefined) window.clearTimeout(timer);
  reminderTimers.delete(taskId);
}

export function scheduleTaskReminder(task: Task) {
  cancelTaskReminder(task.id);
  return () => cancelTaskReminder(task.id);
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
