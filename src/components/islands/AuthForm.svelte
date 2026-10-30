<script lang="ts">
  import { onMount } from 'svelte';
  import { getSession, signIn, signUp, translateAuthError } from '../../lib/auth';
  import { syncNow } from '../../lib/sync';

  let mode = $state<'login' | 'register'>('login');
  let email = $state('');
  let password = $state('');
  let fullName = $state('');
  let busy = $state(false);
  let error = $state('');
  let notice = $state('');

  const next = $derived(typeof window === 'undefined' ? '/' : new URLSearchParams(location.search).get('next') || '/');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    error = ''; notice = '';
    busy = true;
    try {
      if (mode === 'register') {
        const { session } = await signUp(email.trim(), password, fullName.trim() || undefined);
        if (!session) {
          notice = 'Pendaftaran berhasil. Cek email untuk konfirmasi, lalu masuk.';
          mode = 'login';
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      await syncNow();
      location.replace(next);
    } catch (reason) {
      error = translateAuthError(reason instanceof Error ? reason.message : 'Gagal masuk. Coba lagi.');
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    void getSession().then((session) => {
      if (session) location.replace(next);
    });
  });
</script>

<svelte:head><title>Masuk · TaskPulse</title></svelte:head>

<main class="auth-shell">
  <div class="auth-card">
    <a class="brand" href="/" aria-label="TaskPulse, beranda">
      <img src="/icons/mark.svg" alt="" width="34" height="34" />
      <span>TaskPulse</span>
    </a>
    <h1>{mode === 'login' ? 'Masuk ke akunmu' : 'Buat akun baru'}</h1>
    <p class="lede">
      {mode === 'login'
        ? 'Tugasmu tersimpan di akun ini, jadi bisa dibuka dari perangkat mana pun.'
        : 'Cukup email dan password. Tidak ada verifikasi tambahan selain konfirmasi email.'}
    </p>

    <form onsubmit={submit}>
      {#if mode === 'register'}
        <label class="field">Nama <span class="optional">(opsional)</span>
          <input bind:value={fullName} maxlength="80" autocomplete="name" placeholder="Nama panggilan" />
        </label>
      {/if}
      <label class="field">Email
        <input bind:value={email} type="email" required autocomplete="email" placeholder="nama@email.com" />
      </label>
      <label class="field">Password
        <input bind:value={password} type="password" required minlength="6" autocomplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Minimal 6 karakter" />
      </label>

      {#if error}<p class="error" role="alert">{error}</p>{/if}
      {#if notice}<p class="notice" role="status">{notice}</p>{/if}

      <button class="primary" type="submit" disabled={busy}>
        {busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Daftar'}
      </button>
    </form>

    <p class="switch">
      {#if mode === 'login'}
        Belum punya akun? <button type="button" onclick={() => { mode = 'register'; error = ''; notice = ''; }}>Daftar</button>
      {:else}
        Sudah punya akun? <button type="button" onclick={() => { mode = 'login'; error = ''; notice = ''; }}>Masuk</button>
      {/if}
    </p>
  </div>
</main>

<style>
  .auth-shell { min-height: 100vh; display: grid; place-items: center; padding: 24px 18px calc(24px + env(safe-area-inset-bottom)); }
  .auth-card { width: min(100%, 420px); padding: 26px 22px; border: 1px solid #DAD5C7; border-radius: 14px; background: #FFFDF8; box-shadow: 0 4px 24px #1c1b181a; }
  .brand { display: flex; align-items: center; gap: 10px; padding-bottom: 20px; font-weight: 700; font-size: 1.04rem; text-decoration: none; color: #1C1B18; }
  h1 { margin: 0 0 6px; font-size: 1.35rem; letter-spacing: -.02em; }
  .lede { margin: 0 0 20px; color: #55524A; font-size: .88rem; }
  form { display: grid; gap: 13px; }
  .field { display: grid; gap: 6px; font-size: .88rem; font-weight: 600; color: #1C1B18; }
  .optional { color: #6B675C; font-size: .78rem; font-weight: 400; }
  .field input { min-height: 44px; width: 100%; padding: 9px 11px; border: 1px solid #DAD5C7; border-radius: 6px; background: #FFFDF8; color: #1C1B18; font-weight: 400; }
  .primary { min-height: 46px; margin-top: 4px; border: 1px solid transparent; border-radius: 10px; background: #9A3B1B; color: #FFFDF8; font-weight: 650; cursor: pointer; }
  .primary:hover { background: #7F2F16; }
  .primary:disabled { opacity: .6; cursor: wait; }
  .error { margin: 0; color: #A32017; font-size: .85rem; }
  .notice { margin: 0; color: #4F6B4A; font-size: .85rem; }
  .switch { margin: 18px 0 0; color: #55524A; font-size: .85rem; text-align: center; }
  .switch button { border: 0; background: none; color: #9A3B1B; font: inherit; font-weight: 650; cursor: pointer; padding: 4px; }
  :global(.dark) .auth-card { background: #201F1A; border-color: #34322B; color: #F0EDE3; }
  :global(.dark) .brand, :global(.dark) .field { color: #F0EDE3; }
  :global(.dark) .lede, :global(.dark) .switch { color: #B5B0A2; }
  :global(.dark) .field input { background: #171613; border-color: #34322B; color: #F0EDE3; }
  :global(.dark) .primary { background: #E0764B; color: #171613; }
  :global(.dark) .primary:hover { background: #F08B62; }
  :global(.dark) .error { color: #F0857A; }
  :global(.dark) .notice { color: #8FBF87; }
</style>
