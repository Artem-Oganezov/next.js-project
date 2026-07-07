export type GameSounds = {
  playJump(): void;
  playCrash(): void;
  playSave(): void;
  resume(): void;
};

function tone(
  ctx: AudioContext,
  frequency: number,
  durationSec: number,
  type: OscillatorType = "square",
  gain = 0.06,
): void {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  amp.gain.value = gain;
  osc.connect(amp);
  amp.connect(ctx.destination);
  const now = ctx.currentTime;
  amp.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
  osc.start(now);
  osc.stop(now + durationSec);
}

export function createGameSounds(): GameSounds {
  let ctx: AudioContext | null = null;
  const muted = false;

  const ensure = (): AudioContext | null => {
    if (muted) return null;
    if (!ctx) {
      ctx = new AudioContext();
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  };

  return {
    resume() {
      ensure();
    },
    playJump() {
      const audio = ensure();
      if (!audio) return;
      tone(audio, 520, 0.06, "square", 0.05);
    },
    playCrash() {
      const audio = ensure();
      if (!audio) return;
      tone(audio, 120, 0.18, "sawtooth", 0.07);
      tone(audio, 80, 0.22, "triangle", 0.05);
    },
    playSave() {
      const audio = ensure();
      if (!audio) return;
      tone(audio, 440, 0.08, "square", 0.04);
      window.setTimeout(() => tone(audio, 660, 0.1, "square", 0.04), 80);
    },
  };
}
