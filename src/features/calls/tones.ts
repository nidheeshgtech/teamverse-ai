"use client";

/**
 * Ringtone (incoming) and ringback (outgoing) synthesised with Web Audio: no audio files, nothing
 * to download. Browsers may block audio before the first user gesture; then the call is silent but
 * the visual ringing UI still shows.
 */
export function playTone(kind: "ring" | "ringback"): () => void {
  let context: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  try {
    context = new AudioContext();
    const beep = () => {
      if (!context) return;
      const now = context.currentTime;
      const notes = kind === "ring" ? [880, 660] : [440];
      notes.forEach((freq, i) => {
        const osc = context!.createOscillator();
        const gain = context!.createGain();
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0, now + i * 0.22);
        gain.gain.linearRampToValueAtTime(kind === "ring" ? 0.12 : 0.06, now + i * 0.22 + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + i * 0.22 + (kind === "ring" ? 0.2 : 0.9));
        osc.connect(gain).connect(context!.destination);
        osc.start(now + i * 0.22);
        osc.stop(now + i * 0.22 + 1);
      });
    };
    beep();
    timer = setInterval(beep, kind === "ring" ? 1600 : 3000);
  } catch {
    // No audio available; ringing stays visual only.
  }
  return () => {
    if (timer) clearInterval(timer);
    void context?.close().catch(() => {});
    context = null;
  };
}
