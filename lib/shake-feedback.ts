// Audio and Haptic feedback helper for Shake Detection
// Uses Web Audio API for zero-dependency, ultra-low latency emergency tones

class AudioManager {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  playTone(step: 1 | 2 | 3) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      if (step === 1) {
        // Step 1: Crisp single high ping (notification of first shake)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (step === 2) {
        // Step 2: Two ascending double-beeps (warning of second shake)
        [0, 0.11].forEach((delay, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(750 + idx * 150, now + delay);

          gain.gain.setValueAtTime(0.25, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + delay);
          osc.stop(now + delay + 0.1);
        });
      } else if (step === 3) {
        // Step 3: Urgent emergency warble / siren tone (3rd shake - SOS triggered!)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1400, now + 0.25);
        osc.frequency.linearRampToValueAtTime(800, now + 0.45);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      // Audio autoplay policy might restrict if not yet interacted; safely ignore
    }
  }
}

const audioManager = new AudioManager();

export const playShakeTone = (step: 1 | 2 | 3) => {
  audioManager.playTone(step);
};

export const triggerHaptic = (step: 1 | 2 | 3) => {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

  try {
    if (step === 1) {
      navigator.vibrate(120);
    } else if (step === 2) {
      navigator.vibrate([100, 60, 150]);
    } else if (step === 3) {
      navigator.vibrate([300, 100, 300, 100, 500]);
    }
  } catch {
    // Unsupported or permission blocked
  }
};
