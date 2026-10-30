import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { logLoginEvent } from './activity';

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signUp(email: string, password: string, fullName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      // Tautan konfirmasi harus kembali ke domain tempat user mendaftar,
      // bukan ke Site URL bawaan. Domain ini tetap wajib ada di daftar
      // Redirect URLs pada dashboard Supabase.
      emailRedirectTo: typeof location === 'undefined' ? undefined : `${location.origin}/login`
    }
  });
  if (error) throw error;
  if (data.session) await logLoginEvent('signup', 'password');
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await logLoginEvent('login', 'password');
  return data;
}

export async function signOut() {
  await logLoginEvent('logout', 'password');
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Email atau password salah.',
    'Email not confirmed': 'Email belum dikonfirmasi. Periksa kotak masukmu.',
    'User already registered': 'Email ini sudah terdaftar. Coba masuk.',
    'Password should be at least 6 characters': 'Password minimal 6 karakter.',
    'Email rate limit exceeded': 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
    'Failed to fetch': 'Tidak bisa menghubungi server. Periksa koneksi internetmu.',
    'Signups not allowed for this instance': 'Pendaftaran sedang ditutup.',
    'New password should be different from the old password': 'Password baru harus berbeda dari yang lama.'
  };
  if (map[message]) return map[message];
  if (/is invalid/i.test(message)) return 'Format email tidak valid. Periksa kembali alamatnya.';
  if (/already registered/i.test(message)) return 'Email ini sudah terdaftar. Coba masuk.';
  if (/rate limit/i.test(message)) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  return message;
}
