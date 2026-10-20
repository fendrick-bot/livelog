import type { TextOp } from '@livelog/shared';
import { storage } from '../storage';

/**
 * Soundscape: everything is synthesised with the Web Audio API.
 *
 * - Keys: a soft, low typewriter "thock" for every character the writer
 *   types (a gentle bell on new lines), paced so bursts never get noisy.
 * - Ambience: a slow generative lo-fi pad with sparse piano-like plucks and
 *   light rain, for keeping readers company while they wait for words.
 *
 * Browsers only allow audio after a user gesture, so nothing plays until
 * `unlock()` is called from a click.
 */
export interface SoundPrefs {
  keys: boolean;
  music: boolean;
  volume: number;
}

type KeyKind = 'key' | 'space' | 'enter' | 'delete';

const PREFS_KEY = 'livelog:sound';
const DEFAULT_PREFS: SoundPrefs = { keys: true, music: false, volume: 0.6 };

const hz = (midiNote: number) => 440 * 2 ** ((midiNote - 69) / 12);
/** Fmaj7 → Em7 → Dm(add9) → Cmaj7: warm, unresolved, easy to listen to for a long time. */
const PROGRESSION = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 64],
  [48, 55, 59, 64],
];
const BAR_SECONDS = 7;

const classify = (char: string): KeyKind =>
  char === '\n' ? 'enter' : char === ' ' ? 'space' : 'key';

class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private keysBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private music: {
    bus: GainNode;
    timer: ReturnType<typeof setInterval>;
    rain: AudioBufferSourceNode;
  } | null = null;
  private nextBarTime = 0;
  private barIndex = 0;
  private wantAmbience = false;
  private nextKeyAt = 0;

  private prefs: SoundPrefs = {
    ...DEFAULT_PREFS,
    ...storage.get<Partial<SoundPrefs>>(PREFS_KEY, {}),
  };
  private unlocked = false;
  private snapshot = { prefs: this.prefs, unlocked: false };
  private readonly listeners = new Set<() => void>();

  // ── State for React (useSyncExternalStore) ──────────────────────────────
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.snapshot = { prefs: this.prefs, unlocked: this.unlocked };
    for (const listener of this.listeners) listener();
  }

  // ── Public API ──────────────────────────────────────────────────────────
  unlock(): boolean {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    void ctx.resume();
    this.unlocked = true;
    this.syncMusic();
    this.emit();
    return true;
  }

  setPrefs(patch: Partial<SoundPrefs>): void {
    this.prefs = { ...this.prefs, ...patch };
    storage.set(PREFS_KEY, this.prefs);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.prefs.volume * 0.8, this.ctx.currentTime, 0.05);
    }
    this.syncMusic();
    this.emit();
  }

  /** Pages that want background ambience (the live reader) switch it on while mounted. */
  setAmbience(active: boolean): void {
    this.wantAmbience = active;
    this.syncMusic();
  }

  /** Play keystrokes for an incoming live-typing operation. */
  typeBurst(op: TextOp): void {
    if (!this.prefs.keys || !this.unlocked) return;
    if (!op.ins) {
      if (op.del) this.key('delete');
      return;
    }
    const now = performance.now();
    let at = Math.max(now, this.nextKeyAt);
    for (const char of [...op.ins].slice(0, 10)) {
      const kind = classify(char);
      setTimeout(() => this.key(kind), at - now);
      at += 38 + Math.random() * 42;
    }
    // Never drift more than ~0.6s behind the text on screen.
    this.nextKeyAt = Math.min(at, now + 600);
  }

  key(kind: KeyKind): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.keysBus || !this.noise || !this.prefs.keys) return;
    const t = ctx.currentTime + 0.005;
    const rand = Math.random();

    // Felt-dampened click: band-passed noise.
    const click = ctx.createBufferSource();
    click.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value =
      kind === 'space' ? 700 + rand * 150 : kind === 'delete' ? 1200 : 1500 + rand * 700;
    band.Q.value = kind === 'space' ? 1.4 : 1.1;
    const clickGain = ctx.createGain();
    const peak = kind === 'space' ? 0.45 : kind === 'delete' ? 0.22 : 0.3;
    clickGain.gain.setValueAtTime(0.0001, t);
    clickGain.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'space' ? 0.09 : 0.05));
    click.connect(band).connect(clickGain).connect(this.keysBus);
    click.start(t, rand * 0.5, 0.12);

    // Wooden body "thock".
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(kind === 'space' ? 110 : 170 + rand * 40, t);
    body.frequency.exponentialRampToValueAtTime(60, t + 0.06);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, t);
    bodyGain.gain.exponentialRampToValueAtTime(kind === 'space' ? 0.22 : 0.1, t + 0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    body.connect(bodyGain).connect(this.keysBus);
    body.start(t);
    body.stop(t + 0.09);

    // A soft carriage-return bell on new lines.
    if (kind === 'enter') {
      for (const [frequency, level] of [
        [1318.5, 0.05],
        [1975.5, 0.02],
      ] as const) {
        const bell = ctx.createOscillator();
        bell.type = 'sine';
        bell.frequency.value = frequency;
        const bellGain = ctx.createGain();
        bellGain.gain.setValueAtTime(0.0001, t + 0.06);
        bellGain.gain.exponentialRampToValueAtTime(level, t + 0.07);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        bell.connect(bellGain).connect(this.keysBus);
        bell.start(t + 0.06);
        bell.stop(t + 1.6);
      }
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    this.master = ctx.createGain();
    this.master.gain.value = this.prefs.volume * 0.8;
    this.master.connect(ctx.destination);
    this.keysBus = ctx.createGain();
    this.keysBus.gain.value = 0.55;
    this.keysBus.connect(this.master);

    const length = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let index = 0; index < length; index++) data[index] = Math.random() * 2 - 1;

    this.ctx = ctx;
    return ctx;
  }

  private syncMusic(): void {
    const shouldPlay = this.unlocked && this.wantAmbience && this.prefs.music;
    if (shouldPlay && !this.music) this.startMusic();
    if (!shouldPlay && this.music) this.stopMusic();
  }

  private startMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 3);
    bus.connect(this.master);

    // Light rain: filtered, looping noise.
    const rain = ctx.createBufferSource();
    rain.buffer = this.noise;
    rain.loop = true;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 500;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2600;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.045;
    rain.connect(highpass).connect(lowpass).connect(rainGain).connect(bus);
    rain.start();

    this.nextBarTime = ctx.currentTime + 0.2;
    this.barIndex = 0;
    const schedule = () => {
      while (this.music && this.nextBarTime < ctx.currentTime + 2.5) {
        this.scheduleBar(bus, this.nextBarTime, PROGRESSION[this.barIndex % PROGRESSION.length]!);
        this.nextBarTime += BAR_SECONDS;
        this.barIndex++;
      }
    };
    this.music = { bus, rain, timer: setInterval(schedule, 1_000) };
    schedule();
  }

  private stopMusic(): void {
    const ctx = this.ctx;
    const music = this.music;
    this.music = null;
    if (!ctx || !music) return;
    clearInterval(music.timer);
    music.bus.gain.cancelScheduledValues(ctx.currentTime);
    music.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    setTimeout(() => {
      music.rain.stop();
      music.bus.disconnect();
    }, 2_000);
  }

  private scheduleBar(bus: GainNode, start: number, chord: number[]): void {
    const ctx = this.ctx!;
    const end = start + BAR_SECONDS;

    // Warm pad: detuned triangles through a low-pass, cross-fading into the next bar.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 850;
    padFilter.Q.value = 0.4;
    padFilter.connect(bus);
    for (const note of chord) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = hz(note);
      osc.detune.value = (Math.random() - 0.5) * 10;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.03, start + 2.2);
      gain.gain.setValueAtTime(0.03, end - 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, end + 1.8);
      osc.connect(gain).connect(padFilter);
      osc.start(start);
      osc.stop(end + 2);
    }

    // Soft bass.
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = hz(chord[0]! - 12);
    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.0001, start);
    bassGain.gain.exponentialRampToValueAtTime(0.05, start + 1.5);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, end + 1);
    bass.connect(bassGain).connect(bus);
    bass.start(start);
    bass.stop(end + 1.2);

    // A few sparse, piano-like plucks.
    for (let slot = 0; slot < 4; slot++) {
      if (Math.random() > 0.7) continue;
      const at = start + slot * (BAR_SECONDS / 4) + Math.random() * 0.4;
      const note =
        chord[Math.floor(Math.random() * chord.length)]! + (Math.random() > 0.5 ? 12 : 24);
      const pluck = ctx.createOscillator();
      pluck.type = 'sine';
      pluck.frequency.value = hz(note);
      const pluckGain = ctx.createGain();
      pluckGain.gain.setValueAtTime(0.0001, at);
      pluckGain.gain.exponentialRampToValueAtTime(0.045, at + 0.008);
      pluckGain.gain.exponentialRampToValueAtTime(0.0001, at + 2.2);
      pluck.connect(pluckGain).connect(bus);
      pluck.start(at);
      pluck.stop(at + 2.3);
    }
  }
}

export const soundscape = new Soundscape();
