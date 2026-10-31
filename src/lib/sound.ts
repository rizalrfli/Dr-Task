let audio: HTMLAudioElement | undefined;
let unlocked = false;

function element() {
  audio ??= new Audio('/old-phone-ring.mp3');
  audio.preload = 'auto';
  return audio;
}

/** Dipanggil dari gestur pengguna pertama agar pemutaran berikutnya diizinkan browser. */
export function unlockReminderSound() {
  if (unlocked || typeof Audio === 'undefined') return;
  const player = element();
  player.muted = true;
  player.play()
    .then(() => { player.pause(); player.currentTime = 0; player.muted = false; unlocked = true; })
    .catch(() => { player.muted = false; });
}

export function playReminderSound() {
  if (typeof Audio === 'undefined') return;
  const player = element();
  player.muted = false;
  player.currentTime = 0;
  void player.play().catch(() => undefined);
}
