import type { Task } from './types';
import { getTasks, removeTask } from './db';
import { playReminderSound } from './sound';

function notifyIfAllowed(task: Task) {
  if (!task.notify || task.status === 'done' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;
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
const REMINDER_WINDOW_MS = 5 * 60 * 60 * 1000;
const REMINDER_INTERVAL_MS = 10 * 60 * 1000;

export function cancelTaskReminder(taskId: string) {
  const timer = reminderTimers.get(taskId);
  if (timer !== undefined) window.clearTimeout(timer);
  reminderTimers.delete(taskId);
}

export function scheduleTaskReminder(task: Task, now = Date.now()) {
  cancelTaskReminder(task.id);
  if (!task.notify || task.status === 'done' || !task.dueDate) return () => undefined;
  const [year, month, day] = task.dueDate.split('-').map(Number);
  const [hour, minute] = (task.dueTime ?? '09:00').split(':').map(Number);
  const deadline = new Date(year!, month! - 1, day!, hour!, minute!).getTime();
  const delay = deadline - now;
  if (delay <= 0) return () => undefined;

  const firstReminder = () => {
    if (deadline - Date.now() <= 0) return;
    notifyIfAllowed(task);
    const next = window.setTimeout(firstReminder, Math.min(REMINDER_INTERVAL_MS, deadline - Date.now()));
    reminderTimers.set(task.id, next);
  };
  const startDelay = delay > REMINDER_WINDOW_MS ? delay - REMINDER_WINDOW_MS : 0;
  const timer = window.setTimeout(firstReminder, startDelay);
  reminderTimers.set(task.id, timer);
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
