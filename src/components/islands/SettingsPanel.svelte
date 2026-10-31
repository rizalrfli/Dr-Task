<script lang="ts">
  import { onMount } from 'svelte';
  import { getTasks } from '../../lib/db';
  import { exportTasks, importTasks } from '../../lib/export_import';
  import { logActivity } from '../../lib/activity';
  import { getSession, signOut } from '../../lib/auth';
  import { syncNow } from '../../lib/sync';
  import { requestNotificationPermission } from '../../lib/notifications';
  import { subscribeToPush } from '../../lib/push';
  import type { Task } from '../../lib/types';
  let tasks = $state<Task[]>([]);
  let permission = $state<NotificationPermission | 'unsupported' | 'default'>('default');
  let email = $state('');
  let feedback = $state('');
  let error = $state('');
  let busy = $state(false);
  async function refresh() { try { tasks = await getTasks(); } catch { error = 'Data perangkat tidak bisa dibaca. Coba muat ulang.'; } }
  async function logout() {
    if (!confirm('Keluar dari akun ini? Tugas tetap tersimpan di server dan bisa dibuka lagi setelah masuk.')) return;
    await signOut().catch(() => {});
    location.replace('/login');
  }
  async function enableNotifications() {
    error = ''; feedback = '';
     try { permission = await requestNotificationPermission(); if (permission === 'granted') { await subscribeToPush(); feedback = 'Push aktif di perangkat ini. Pengingat dikirim dari server.'; void logActivity('settings_changed', { entityType: 'setting', entityId: 'notifications', metadata: { value: 'granted' } }); } else if (permission === 'denied') error = 'Izin ditolak. Ubah izin notifikasi TaskPulse dari pengaturan browser.'; else if (permission === 'unsupported') error = 'Browser ini tidak mendukung notifikasi.'; }
    catch { error = 'Izin notifikasi tidak dapat diminta. Pastikan halaman dibuka lewat HTTPS atau localhost.'; }
  }
  function backup() { exportTasks(tasks); feedback = 'Salinan data mulai diunduh.'; void logActivity('export', { entityType: 'backup', metadata: { count: tasks.length } }); }
  async function restore(event: Event) {
    const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
    if (!confirm('Impor ini akan mengganti semua tugas yang tersimpan di perangkat. Lanjutkan?')) { input.value = ''; return; }
    busy = true; error = ''; feedback = '';
    try {
      const count = await importTasks(file);
      await refresh();
      feedback = `${count} tugas berhasil dipulihkan.`;
      window.dispatchEvent(new Event('taskpulse:tasks-changed'));
      void logActivity('import', { entityType: 'backup', metadata: { count } });
      void syncNow().then(() => window.dispatchEvent(new Event('taskpulse:tasks-changed')));
    }
    catch (reason) { error = reason instanceof Error ? reason.message : 'File tidak dapat diimpor.'; }
    finally { busy = false; input.value = ''; }
  }
  onMount(() => {
    void refresh();
    permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    void getSession().then((session) => { email = session?.user.email ?? ''; });
  });
  let selectedTheme = $state('light');
  $effect(() => { selectedTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; });
</script>

<svelte:head><title>Pengaturan · TaskPulse</title></svelte:head>

<div class="settings">
  <section class="setting-section"><div class="section-copy"><h2>Akun</h2><p>{email ? `Masuk sebagai ${email}. Tugas tersinkron ke akun ini.` : 'Memuat info akun…'}</p></div><div class="setting-action"><button class="secondary-button" type="button" onclick={() => void logout()}>Keluar</button></div></section>
  <section class="setting-section"><div class="section-copy"><h2>Pengingat deadline</h2><p>Daftarkan perangkat ini agar server dapat mengirim push saat aplikasi ditutup. Push memerlukan izin browser serta konfigurasi server.</p></div><div class="setting-action"><button class="secondary-button" type="button" onclick={() => void enableNotifications()} disabled={permission === 'unsupported'}>{permission === 'granted' ? 'Aktifkan push di perangkat ini' : permission === 'unsupported' ? 'Tidak didukung' : 'Izinkan notifikasi'}</button></div></section>
  <section class="setting-section"><div class="section-copy"><h2>Tema tampilan</h2><p>Pilih tampilan yang nyaman. Pilihan ini disimpan di browser perangkat ini.</p></div><label class="theme-choice"><span class="sr-only">Pilih tema</span><select bind:value={selectedTheme} onchange={(event) => { const value = (event.currentTarget as HTMLSelectElement).value; document.documentElement.classList.toggle('dark', value === 'dark'); localStorage.setItem('taskpulse-theme', value); void logActivity('settings_changed', { entityType: 'setting', entityId: 'theme', metadata: { value } }); }}><option value="light">Terang</option><option value="dark">Gelap</option></select></label></section>
  <section class="setting-section backup-section"><div class="section-copy"><h2>Cadangan tugas</h2><p>{tasks.length} tugas tersimpan di perangkat ini. Ekspor file JSON untuk menyimpan salinan, lalu impor kembali jika diperlukan.</p></div><div class="backup-actions"><button class="secondary-button" type="button" onclick={backup} disabled={tasks.length === 0}>Ekspor JSON</button><label class="secondary-button import-button">{busy ? 'Mengimpor…' : 'Impor JSON'}<input type="file" accept="application/json,.json" onchange={restore} disabled={busy} /></label></div></section>
  <aside class="privacy"><h2>Data tersimpan di akunmu</h2><p>Tugas disalin ke server agar bisa dibuka dari perangkat lain, sementara perangkat ini tetap menyimpan salinan untuk mode offline. Riwayat masuk dan aktivitas dicatat pada akun yang sama.</p></aside>
  {#if feedback}<p class="feedback" role="status">{feedback}</p>{/if}{#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .settings { display: grid; gap: 0; }.setting-section { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 20px 0; border-bottom: 1px solid #DAD5C7; }.section-copy { min-width: 0; }.section-copy h2 { margin: 0 0 5px; font-size: 1.02rem; }.section-copy p { max-width: 54ch; margin: 0; color: #55524A; font-size: .86rem; }.setting-action,.backup-actions { flex: 0 0 auto; }.secondary-button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0 13px; border: 1px solid #DAD5C7; border-radius: 8px; background: #FFFDF8; color: #1C1B18; font-size: .84rem; font-weight: 600; cursor: pointer; }.secondary-button:disabled { opacity: .5; cursor: not-allowed; }.theme-choice select { min-height: 44px; padding: 0 30px 0 12px; border: 1px solid #DAD5C7; border-radius: 8px; background: #FFFDF8; color: #1C1B18; }.permission { display: block; padding: 10px 0; font-size: .83rem; font-weight: 650; }.granted { color: #4F6B4A; }.denied,.error { color: #A32017; }.backup-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }.import-button { position: relative; overflow: hidden; }.import-button input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }.privacy { margin-top: 24px; padding: 15px; border-radius: 10px; background: #ECE9E0; }.privacy h2 { margin: 0 0 4px; font-size: .93rem; }.privacy p { margin: 0; color: #55524A; font-size: .82rem; }.feedback,.error { margin: 14px 0 0; font-size: .85rem; }.feedback { color: #4F6B4A; }.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
  :global(.dark) .setting-section { border-color: #34322B; }:global(.dark) .section-copy p,:global(.dark) .privacy p { color: #B5B0A2; }:global(.dark) .secondary-button,:global(.dark) .theme-choice select { border-color: #34322B; background: #201F1A; color: #F0EDE3; }:global(.dark) .privacy { background: #201F1A; }:global(.dark) .granted,:global(.dark) .feedback { color: #8FBF87; }:global(.dark) .denied,:global(.dark) .error { color: #F0857A; }
  @media (max-width: 560px) { .setting-section { flex-direction: column; gap: 11px; }.backup-actions { justify-content: flex-start; } }
</style>
