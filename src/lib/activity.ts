import { clearQueuedActivity, queueActivity, takeQueuedActivity } from './db';
import { supabase } from './supabase';

export type ActivityEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_reopened'
  | 'task_deleted'
  | 'export'
  | 'import'
  | 'settings_changed';

export type LoginEventType = 'signup' | 'login' | 'logout';

export interface ActivityEvent {
  eventType: ActivityEventType;
  entityType?: string;
  entityId?: string;
  path?: string;
  metadata?: Record<string, unknown>;
  userAgent?: string;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function userAgent(): string | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.userAgent.slice(0, 400);
}

/**
 * Catat aktivitas. Event masuk antrean lokal lebih dulu agar tidak hilang saat offline,
 * lalu langsung dicoba dikirim. Kegagalan kirim bukan kegagalan aksi pengguna.
 */
export async function logActivity(eventType: ActivityEventType, options: Omit<ActivityEvent, 'eventType'> = {}): Promise<void> {
  try {
    await queueActivity({ eventType, userAgent: userAgent(), path: typeof location === 'undefined' ? undefined : location.pathname, ...options });
    await flushActivity();
  } catch {
    // pencatatan tidak boleh mengganggu alur utama
  }
}

export async function flushActivity(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const queued = await takeQueuedActivity();
  if (queued.length === 0) return;

  const rows = queued.map(({ localId: _localId, ...event }) => ({
    user_id: userId,
    session_id: null,
    event_type: event.eventType,
    entity_type: event.entityType ?? null,
    entity_id: event.entityId ?? null,
    path: event.path ?? null,
    metadata: event.metadata ?? {},
    user_agent: event.userAgent ?? null
  }));

  const { error } = await supabase.from('activity_log').insert(rows);
  if (error) return; // biarkan di antrean, dicoba lagi nanti
  await clearQueuedActivity(queued.map((item) => item.localId));
}

export async function logLoginEvent(event: LoginEventType, method: string): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;
    await supabase.from('login_events').insert({ user_id: userId, event, method, user_agent: userAgent() ?? null });
    await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId);
  } catch {
    // diabaikan: riwayat login tidak boleh memblokir autentikasi
  }
}
