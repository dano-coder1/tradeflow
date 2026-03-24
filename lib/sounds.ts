export type SoundType = "success" | "warning" | "mistake" | "insight";

interface Tone {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gainStart: number;
}

const TONES: Record<SoundType, Tone> = {
  success:  { frequency: 880,  duration: 0.15, type: "sine",     gainStart: 0.25 },
  warning:  { frequency: 440,  duration: 0.25, type: "triangle", gainStart: 0.2  },
  mistake:  { frequency: 200,  duration: 0.3,  type: "sawtooth", gainStart: 0.15 },
  insight:  { frequency: 660,  duration: 0.2,  type: "sine",     gainStart: 0.2  },
};

export function playSound(type: SoundType): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const { frequency, duration, type: waveType, gainStart } = TONES[type];
    osc.type = waveType;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(gainStart, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => ctx.close();
  } catch {
    // Audio unavailable or blocked — fail silently
  }
}
