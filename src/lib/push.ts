import { supabase } from './supabase';

export const PUSH_ACTIVE_KEY = 'taskpulse:push-active';

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function subscribeToPush(): Promise<void> {
  const key = import.meta.env.PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error('Kunci publik push belum dikonfigurasi di aplikasi.');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push notification tidak didukung browser ini.');

  const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(key)
  });
  const json = subscription.toJSON();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  if (authError || !session) throw new Error('Sesi akun tidak ditemukan. Silakan masuk kembali.');
  const response = await fetch(`${import.meta.env.PUBLIC_SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ user_id: session.user.id, endpoint: json.endpoint, subscription: json })
  });
  if (!response.ok) throw new Error('Langganan push gagal disimpan ke akun.');
  localStorage.setItem(PUSH_ACTIVE_KEY, '1');
}
