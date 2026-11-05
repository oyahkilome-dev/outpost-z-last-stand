/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Procedural Web Audio API sound synthesizer for Outpost Z: Last Stand
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;
  private volume: number = 0.8;
  private isResuming: boolean = false;

  private lowpassFilter: BiquadFilterNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceLfo: OscillatorNode | null = null;
  private isAmbienceRunning: boolean = false;
  private ambienceVolume: number = 0.6;

  constructor() {
    // Register automatic global user-gesture listeners to unlock audio seamlessly on first tap/click/key
    if (typeof window !== 'undefined') {
      const unlockEvents = ['pointerdown', 'touchstart', 'click', 'keydown'];
      const unlockHandler = () => {
        this.ensureAudioContext();
      };
      unlockEvents.forEach((ev) => {
        window.addEventListener(ev, unlockHandler, { once: true, passive: true });
      });
    }
  }

  /**
   * Lazily initializes and safely resumes the Web Audio API AudioContext.
   * Required by modern browsers to transition out of 'suspended' state upon user interaction.
   */
  public async ensureAudioContext(): Promise<AudioContext | null> {
    try {
      if (!this.ctx) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);

          // Dynamic Master Low-Pass Filter for muffled pause / armory shop mode
          this.lowpassFilter = this.ctx.createBiquadFilter();
          this.lowpassFilter.type = 'lowpass';
          this.lowpassFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);

          this.masterGain.connect(this.lowpassFilter);
          this.lowpassFilter.connect(this.ctx.destination);
        }
      }

      if (this.ctx && (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted') && !this.isResuming) {
        this.isResuming = true;
        await this.ctx.resume().catch((err) => {
          console.warn('AudioContext resume deferred until gesture:', err);
        });
        this.isResuming = false;
      }
    } catch (err) {
      this.isResuming = false;
      console.warn('AudioContext initialization/resume warning:', err);
    }
    return this.ctx;
  }

  // Alias for explicit calls
  public async resumeAudio(): Promise<AudioContext | null> {
    return this.ensureAudioContext();
  }

  public setConfig(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime);
      } catch {
        // Fallback if audio context isn't ready
      }
    }
  }

  /**
   * Set lowpass filter for underwater/muffled cinematic audio when paused or shop is active
   */
  public setLowpassFilter(muffled: boolean) {
    if (!this.ctx || !this.lowpassFilter) return;
    try {
      const t = this.ctx.currentTime;
      const targetFreq = muffled ? 550 : 20000;
      this.lowpassFilter.frequency.cancelScheduledValues(t);
      this.lowpassFilter.frequency.setValueAtTime(this.lowpassFilter.frequency.value, t);
      this.lowpassFilter.frequency.exponentialRampToValueAtTime(targetFreq, t + 0.22);
    } catch {
      // AudioContext state guard
    }
  }

  /**
   * Atmospheric Dusk Soundscape Synthesizer:
   * Ambient wind rumble layered with subtle low-frequency air resonance
   */
  public async startAmbience() {
    if (!this.enabled || this.isAmbienceRunning) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;

      // 1. Generate 4-second brownian-noise loop for dusk wind
      const bufferSize = ctx.sampleRate * 4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.025 * white) / 1.025;
        lastOut = data[i];
      }

      this.ambienceSource = ctx.createBufferSource();
      this.ambienceSource.buffer = buffer;
      this.ambienceSource.loop = true;

      // Wind filter with gentle cutoff
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, t);

      // Low frequency modulation (LFO) for wind gusts
      this.ambienceLfo = ctx.createOscillator();
      this.ambienceLfo.type = 'sine';
      this.ambienceLfo.frequency.setValueAtTime(0.18, t); // 0.18 Hz slow cycle
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(65, t);
      this.ambienceLfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      this.ambienceGain = ctx.createGain();
      const targetVol = this.ambienceVolume * 0.45;
      this.ambienceGain.gain.setValueAtTime(0.001, t);
      this.ambienceGain.gain.linearRampToValueAtTime(targetVol, t + 1.2);

      this.ambienceSource.connect(filter);
      filter.connect(this.ambienceGain);
      this.ambienceGain.connect(this.masterGain);

      this.ambienceLfo.start(t);
      this.ambienceSource.start(t);
      this.isAmbienceRunning = true;
    } catch (e) {
      console.warn('Failed to start ambience:', e);
    }
  }

  public stopAmbience() {
    if (!this.isAmbienceRunning) return;
    try {
      if (this.ctx && this.ambienceGain) {
        const t = this.ctx.currentTime;
        this.ambienceGain.gain.setValueAtTime(this.ambienceGain.gain.value, t);
        this.ambienceGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      }
      setTimeout(() => {
        try {
          this.ambienceSource?.stop();
          this.ambienceSource?.disconnect();
          this.ambienceLfo?.stop();
          this.ambienceLfo?.disconnect();
          this.ambienceGain?.disconnect();
        } catch {
          // ignore cleanup errors
        }
        this.ambienceSource = null;
        this.ambienceLfo = null;
        this.ambienceGain = null;
        this.isAmbienceRunning = false;
      }, 380);
    } catch {
      this.isAmbienceRunning = false;
    }
  }

  public setAmbienceVolume(volume: number) {
    this.ambienceVolume = Math.max(0, Math.min(1, volume));
    if (this.ambienceGain && this.ctx && this.isAmbienceRunning) {
      try {
        const t = this.ctx.currentTime;
        this.ambienceGain.gain.setValueAtTime(this.ambienceGain.gain.value, t);
        this.ambienceGain.gain.linearRampToValueAtTime(this.ambienceVolume * 0.45, t + 0.1);
      } catch {
        // Fallback
      }
    }
  }

  /**
   * Gunshot Synthesizer:
   * Generates a sharp white-noise burst layered with a punchy low-frequency
   * pitch drop (800Hz dropping rapidly to 60Hz over 0.25s) through GainNode envelopes,
   * plus a tactile mechanical slide return click at t + 0.11s.
   */
  public async playGunshot() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Sharp white-noise burst (crack / explosion muzzle blast)
    const noiseDuration = 0.18;
    const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Exponentially decaying white noise for crisp crack
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.035));
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(5000, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(800, t + 0.15);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.18);

    // 2. Punchy body: Pitch drop from 800Hz down to 60Hz over 0.25s
    const punchOsc = ctx.createOscillator();
    punchOsc.type = 'sawtooth';
    punchOsc.frequency.setValueAtTime(800, t);
    punchOsc.frequency.exponentialRampToValueAtTime(60, t + 0.25);

    const punchFilter = ctx.createBiquadFilter();
    punchFilter.type = 'lowpass';
    punchFilter.frequency.setValueAtTime(1400, t);
    punchFilter.frequency.exponentialRampToValueAtTime(180, t + 0.25);

    const punchGain = ctx.createGain();
    punchGain.gain.setValueAtTime(1.0, t);
    punchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    punchOsc.connect(punchFilter);
    punchFilter.connect(punchGain);
    punchGain.connect(this.masterGain);

    punchOsc.start(t);
    punchOsc.stop(t + 0.26);

    // 3. Sub-bass kick thump for physical feedback
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(150, t);
    subOsc.frequency.exponentialRampToValueAtTime(40, t + 0.2);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.85, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(t);
    subOsc.stop(t + 0.21);

    // 4. Tactile mechanical slide return click
    this.scheduleMechanicalClick(t + 0.11, 1150, 0.035, 0.4);
  }

  // Dry fire click when magazine is empty
  public async playDryFire() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(350, t + 0.05);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.055);
  }

  // Alias
  public playEmptyClick = () => this.playDryFire();

  // Tactical reload sequence (magazine slide out, lock in, slide rack)
  public async playReload() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // Step 1: Eject click at 0.1s
    this.scheduleMechanicalClick(t + 0.1, 750, 0.04, 0.45);

    // Step 2: Fresh mag slide insert at 0.75s
    this.scheduleMechanicalClick(t + 0.75, 420, 0.06, 0.55);
    this.scheduleMechanicalClick(t + 0.85, 950, 0.05, 0.6);

    // Step 3: Chamber slide rack at 1.35s
    this.scheduleMechanicalClick(t + 1.35, 1400, 0.06, 0.75);
    this.scheduleMechanicalClick(t + 1.45, 800, 0.07, 0.65);
  }

  private scheduleMechanicalClick(time: number, freq: number, duration: number, vol: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, time + duration);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  // Heartbeat loop state
  private heartbeatIntervalId: number | null = null;

  /**
   * Visceral player damage sound: blunt impact thud layered with gasp/air compression
   */
  public async playPlayerHurt() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Heavy visceral blunt body impact (pitch drop 140Hz -> 38Hz)
    const impactOsc = ctx.createOscillator();
    impactOsc.type = 'sawtooth';
    impactOsc.frequency.setValueAtTime(140, t);
    impactOsc.frequency.exponentialRampToValueAtTime(38, t + 0.24);

    const impactFilter = ctx.createBiquadFilter();
    impactFilter.type = 'lowpass';
    impactFilter.frequency.setValueAtTime(450, t);
    impactFilter.frequency.exponentialRampToValueAtTime(80, t + 0.24);

    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(1.1, t);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    impactOsc.connect(impactFilter);
    impactFilter.connect(impactGain);
    impactGain.connect(this.masterGain);

    impactOsc.start(t);
    impactOsc.stop(t + 0.26);

    // 2. Gasp / air impact transient (filtered breath compression)
    const noiseDuration = 0.16;
    const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(650, t);
    noiseFilter.Q.setValueAtTime(2.0, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDuration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseSource.start(t);
    noiseSource.stop(t + noiseDuration);
  }

  // Alias for backward compatibility
  public playDamage = () => this.playPlayerHurt();
  public playHit = () => this.playPlayerHurt();

  /**
   * Low-Health Sub-Bass Heartbeat:
   * Double-thud rhythmic pulse (lub-dub) when health is critical (HP <= 30)
   */
  public playHeartbeat() {
    if (!this.enabled || this.heartbeatIntervalId !== null) return;

    const triggerPulse = async () => {
      if (!this.enabled || !this.ctx || !this.masterGain) return;
      await this.ensureAudioContext();
      if (!this.ctx || !this.masterGain) return;

      const ctx = this.ctx;
      const t = ctx.currentTime;

      // Thud 1 (Lub)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(75, t);
      osc1.frequency.exponentialRampToValueAtTime(45, t + 0.1);

      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(0.75, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(t);
      osc1.stop(t + 0.12);

      // Thud 2 (Dub) - 180ms later, slightly deeper
      const t2 = t + 0.18;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(62, t2);
      osc2.frequency.exponentialRampToValueAtTime(36, t2 + 0.14);

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.9, t2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.15);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(t2);
      osc2.stop(t2 + 0.16);
    };

    // Trigger initial beat immediately and then set interval (~70 BPM)
    triggerPulse();
    this.heartbeatIntervalId = window.setInterval(triggerPulse, 860);
  }

  public stopHeartbeat() {
    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  // Procedural asphalt boot footstep sound
  public async playFootstep(isSprinting: boolean = false) {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pitchVar = 0.92 + Math.random() * 0.16;

    // 1. Scuff/grit noise (short friction on asphalt)
    const noiseDuration = isSprinting ? 0.08 : 0.06;
    const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime((isSprinting ? 950 : 750) * pitchVar, t);

    const noiseGain = ctx.createGain();
    const noiseVol = isSprinting ? 0.28 : 0.18;
    noiseGain.gain.setValueAtTime(noiseVol, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDuration);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseSource.start(t);
    noiseSource.stop(t + noiseDuration);

    // 2. Low-frequency heel thud
    const osc = ctx.createOscillator();
    const thudGain = ctx.createGain();

    osc.type = 'triangle';
    const startFreq = (isSprinting ? 120 : 95) * pitchVar;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.09);

    const thudVol = isSprinting ? 0.4 : 0.26;
    thudGain.gain.setValueAtTime(thudVol, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(thudGain);
    thudGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Next wave tactical dual-tone military horn alert
  public async playWaveAlert() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Dual-tone military fanfare horn with rich harmonic brass oscillators
    const chordTones = [
      { f1: 370.0, f2: 185.0, time: 0.0, dur: 0.18 }, // F#4 + F#3
      { f1: 554.37, f2: 277.18, time: 0.16, dur: 0.22 }, // C#5 + C#4
      { f1: 740.0, f2: 370.0, time: 0.36, dur: 0.65 }, // F#5 + F#4 sustained power horn
    ];

    chordTones.forEach((tone) => {
      const start = t + tone.time;
      const oscSaw = ctx.createOscillator();
      const oscTri = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      oscSaw.type = 'sawtooth';
      oscSaw.frequency.setValueAtTime(tone.f1, start);

      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(tone.f2, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, start);
      filter.frequency.exponentialRampToValueAtTime(3200, start + tone.dur * 0.4);
      filter.frequency.exponentialRampToValueAtTime(600, start + tone.dur);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.5, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + tone.dur);

      oscSaw.connect(filter);
      oscTri.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      oscSaw.start(start);
      oscTri.start(start);
      oscSaw.stop(start + tone.dur + 0.02);
      oscTri.stop(start + tone.dur + 0.02);
    });
  }

  // Wave Cleared Triumphant Brass Fanfare
  public async playWaveClear() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Ascending brass arpeggio: G4 (392Hz) -> C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (784Hz)
    const notes = [
      { freq: 392.0, time: 0.0, dur: 0.18 },
      { freq: 523.25, time: 0.15, dur: 0.18 },
      { freq: 659.25, time: 0.30, dur: 0.22 },
      { freq: 784.0, time: 0.48, dur: 0.85 },
    ];

    notes.forEach((note) => {
      const start = t + note.time;
      const osc = ctx.createOscillator();
      const oscSub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(note.freq, start);

      oscSub.type = 'triangle';
      oscSub.frequency.setValueAtTime(note.freq * 0.5, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, start);
      filter.frequency.exponentialRampToValueAtTime(800, start + note.dur);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.45, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.dur);

      osc.connect(filter);
      oscSub.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(start);
      oscSub.start(start);
      osc.stop(start + note.dur + 0.05);
      oscSub.stop(start + note.dur + 0.05);
    });
  }

  /**
   * Fast Runner Zombie Shriek:
   * Terrifying, high-pitched screech and hissing vocal rasp (FM synthesized 1800Hz-2600Hz + noise burst)
   */
  public async playRunnerShriek() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.55;

    // 1. High screaming FM carrier
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(1900, t);
    carrier.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
    carrier.frequency.exponentialRampToValueAtTime(1200, t + duration);

    // FM Modulator for frenzied vibrato screech
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(65, t);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(280, t);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.Q.setValueAtTime(3.0, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.55, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    mod.start(t);
    carrier.start(t);
    mod.stop(t + duration);
    carrier.stop(t + duration);

    // 2. High-passed hiss burst layer
    const bufferSize = Math.floor(ctx.sampleRate * 0.35);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.12));
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(2800, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseSource.start(t);
    noiseSource.stop(t + 0.36);
  }

  // Alias
  public playWaveHorn = () => this.playWaveAlert();

  // Tactical UI button click
  public async playUIClick() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.04);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  // Quick audio output confirmation test tone
  public async playTestTone() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.setValueAtTime(990, t + 0.08); // Ascending two-tone confirmation

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.29);
  }

  // Game over dark minor defeat chord and descending pitch drone
  public async playGameOver() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 2.4;

    // Dark minor chord notes (D minor: D2 73.4Hz, F2 87.3Hz, A2 110Hz, D3 146.8Hz)
    const chordNotes = [73.4, 87.3, 110.0, 146.8];

    chordNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      // Slow descending pitch bend for ominous defeat
      osc.frequency.exponentialRampToValueAtTime(freq * 0.72, t + duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, t);
      filter.frequency.exponentialRampToValueAtTime(140, t + duration);

      const noteVol = (0.35 / chordNotes.length) * (idx === 0 ? 1.6 : 1.0);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(noteVol, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t);
      osc.stop(t + duration + 0.05);
    });

    // Sub-bass rumble drop
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(60, t);
    subOsc.frequency.exponentialRampToValueAtTime(24, t + duration);

    subGain.gain.setValueAtTime(0.55, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(t);
    subOsc.stop(t + duration + 0.05);
  }

  // Dynamic Hit Marker tick confirmation sound
  public async playHitTick(isKill: boolean = false) {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const baseFreq = isKill ? 2800 : 2200;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + 0.05);

    gain.gain.setValueAtTime(isKill ? 0.45 : 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.055);

    if (isKill) {
      // Secondary ascending confirmation chirp for fatal shot
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(3200, t + 0.03);
      osc2.frequency.exponentialRampToValueAtTime(4200, t + 0.08);

      gain2.gain.setValueAtTime(0.35, t + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);

      osc2.start(t + 0.03);
      osc2.stop(t + 0.095);
    }
  }

  // Target dummy impact sound (wooden/metal clack)
  public async playTargetImpact() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Transient click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.06);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.075);
  }

  // Target dummy break / destroy sound
  public async playTargetDestroy() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Crunch noise
    const bufferSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.13);
  }

  // Wall/concrete ricochet ping
  public async playRicochet() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startFreq = 1600 + Math.random() * 600;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.5, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.12);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  /**
   * Zombie Ambient / Chasing Groan:
   * Eerie guttural low-frequency gargle using FM synthesis with a low-pass vocal filter.
   */
  public async playZombieGroan(pitchVariation: number = 1.0) {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.9 + Math.random() * 0.4;

    // Carrier oscillator: sawtooth wave in low vocal formant range (70Hz - 95Hz)
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    const basePitch = (72 + Math.random() * 20) * pitchVariation;
    carrier.frequency.setValueAtTime(basePitch, t);
    carrier.frequency.linearRampToValueAtTime(basePitch * 0.85, t + duration * 0.5);
    carrier.frequency.linearRampToValueAtTime(basePitch * 0.7, t + duration);

    // Modulator oscillator: creates deep guttural vocal vibration (18Hz - 28Hz)
    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(22 + Math.random() * 6, t);

    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(35, t);
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Vocal tract biquad formant filter (bandpass at 450Hz)
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, t);
    filter.Q.setValueAtTime(3.5, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.42, t + 0.2);
    gain.gain.linearRampToValueAtTime(0.35, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    modulator.start(t);
    carrier.start(t);
    modulator.stop(t + duration);
    carrier.stop(t + duration);
  }

  /**
   * Zombie Hurt Grunt:
   * Punchy, visceral throat grunt when taking bullet damage.
   */
  public async playZombieHurt() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.22;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const startPitch = 140 + Math.random() * 30;
    osc.frequency.setValueAtTime(startPitch, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  /**
   * Zombie Death Gargle:
   * Low gargling collapse rasp as the zombie is eliminated.
   */
  public async playZombieDeath() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.75;

    // 1. Gargling descending pitch
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + duration);

    // Modulation for rattling gargle
    const mod = ctx.createOscillator();
    mod.type = 'square';
    mod.frequency.setValueAtTime(26, t);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(40, t);
    mod.connect(modGain);
    modGain.connect(osc.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    mod.start(t);
    osc.start(t);
    mod.stop(t + duration);
    osc.stop(t + duration);
  }

  /**
   * Critical Headshot Chime:
   * Satisfying, crisp dual-frequency bell chime (3400Hz + 5100Hz) confirming a fatal headshot.
   */
  public async playHeadshotChime() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // High golden ping 1
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(3200, t);
    osc1.frequency.exponentialRampToValueAtTime(3800, t + 0.05);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.5, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.33);

    // Harmonic overtone 2 (bright crystal shimmer)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(4800, t);
    osc2.frequency.exponentialRampToValueAtTime(5400, t + 0.06);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.35, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t);
    osc2.stop(t + 0.29);

    // Sub-snap transient for tactile punch
    const snapOsc = ctx.createOscillator();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(1200, t);
    snapOsc.frequency.exponentialRampToValueAtTime(200, t + 0.04);
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.4, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    snapOsc.connect(snapGain);
    snapGain.connect(this.masterGain);
    snapOsc.start(t);
    snapOsc.stop(t + 0.045);
  }

  /**
   * Combat Shotgun Boom + Pump Slide:
   * Explosive low-end boom layered with widespread pellet crack, followed by pump rack.
   */
  public async playShotgun() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Massive bass thump (180Hz -> 35Hz)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(180, t);
    subOsc.frequency.exponentialRampToValueAtTime(35, t + 0.35);

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(450, t);
    subFilter.frequency.exponentialRampToValueAtTime(80, t + 0.35);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(1.4, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(t);
    subOsc.stop(t + 0.36);

    // 2. Wide pellet blast noise
    const noiseDuration = 0.22;
    const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1600, t);
    noiseFilter.Q.setValueAtTime(1.2, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDuration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseSource.start(t);
    noiseSource.stop(t + noiseDuration);

    // 3. Pump action rack slide at t + 0.35s
    this.scheduleMechanicalClick(t + 0.35, 880, 0.05, 0.55);
    this.scheduleMechanicalClick(t + 0.44, 1320, 0.06, 0.65);
  }

  /**
   * AK Tactical Rifle Report:
   * Crisp, rapid metallic staccato gunfire with percussive muzzle pop.
   */
  public async playRifle() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Sharp metallic crack
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.14);

    // 2. High snap transient
    const snap = ctx.createOscillator();
    snap.type = 'square';
    snap.frequency.setValueAtTime(1400, t);
    snap.frequency.exponentialRampToValueAtTime(400, t + 0.04);
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.5, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    snap.connect(snapGain);
    snapGain.connect(this.masterGain);
    snap.start(t);
    snap.stop(t + 0.045);

    // 3. Crisp mechanical bolt cycle click
    this.scheduleMechanicalClick(t + 0.055, 1050, 0.025, 0.4);
  }

  /**
   * MP5 Tactical SMG Report:
   * Rapid, high-cyclic 9mm crack with sharp transient and quick mechanical chatter.
   */
  public async playSMG() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Crisp 9mm submachine pop
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.75, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.095);

    // 2. High snap click
    const snap = ctx.createOscillator();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(1800, t);
    snap.frequency.exponentialRampToValueAtTime(600, t + 0.03);
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.45, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    snap.connect(snapGain);
    snapGain.connect(this.masterGain);
    snap.start(t);
    snap.stop(t + 0.035);

    this.scheduleMechanicalClick(t + 0.04, 1200, 0.02, 0.35);
  }

  /**
   * M249 Heavy LMG Report:
   * Heavy 5.56 belt-fed automatic roar with punchy sub-thud and heavy chamber clatter.
   */
  public async playLMG() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Heavy mid-bass punch
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(280, t);
    subOsc.frequency.exponentialRampToValueAtTime(55, t + 0.16);

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(1600, t);
    subFilter.frequency.exponentialRampToValueAtTime(180, t + 0.16);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(1.15, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(t);
    subOsc.stop(t + 0.17);

    // 2. Metallic belt-feed clatter
    this.scheduleMechanicalClick(t + 0.03, 1400, 0.03, 0.5);
    this.scheduleMechanicalClick(t + 0.065, 820, 0.035, 0.45);
  }

  /**
   * M82 .50 Cal Sniper Rifle:
   * Thunderous, deafening anti-materiel cannon report with massive sub-bass shockwave.
   */
  public async playSniper() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Massive Sub-bass shockwave thump (240Hz -> 25Hz over 0.6s)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(240, t);
    subOsc.frequency.exponentialRampToValueAtTime(25, t + 0.6);

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(600, t);
    subFilter.frequency.exponentialRampToValueAtTime(60, t + 0.6);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(1.6, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(t);
    subOsc.stop(t + 0.66);

    // 2. High-energy explosive muzzle blast noise
    const noiseDuration = 0.35;
    const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2200, t);
    noiseFilter.Q.setValueAtTime(1.5, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDuration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseSource.start(t);
    noiseSource.stop(t + noiseDuration);

    // 3. Heavy bolt rack sound
    this.scheduleMechanicalClick(t + 0.22, 540, 0.08, 0.7);
    this.scheduleMechanicalClick(t + 0.32, 980, 0.06, 0.6);
  }

  /**
   * Brass Shell Casing Clinking on Ground
   */
  public async playShellDrop() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = 2600 + Math.random() * 600;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, t + 0.04);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  /**
   * Plant Claymore Mine Sound
   */
  public async playClaymorePlant() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Mechanical leg clamp
    this.scheduleMechanicalClick(t, 450, 0.05, 0.6);
    this.scheduleMechanicalClick(t + 0.08, 880, 0.04, 0.5);

    // Electronic arming chirp
    const ctx = this.ctx;
    const beep = ctx.createOscillator();
    const beepGain = ctx.createGain();
    beep.type = 'sine';
    beep.frequency.setValueAtTime(1760, t + 0.2);
    beepGain.gain.setValueAtTime(0.4, t + 0.2);
    beepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    beep.connect(beepGain);
    beepGain.connect(this.masterGain);
    beep.start(t + 0.2);
    beep.stop(t + 0.29);
  }

  /**
   * Claymore Mine Detonation Sound
   */
  public async playClaymoreDetonate() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Initial sensor trip click
    this.scheduleMechanicalClick(t, 2200, 0.02, 0.8);

    // 2. High-explosive blast at t + 0.05s
    const detTime = t + 0.05;
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(260, detTime);
    subOsc.frequency.exponentialRampToValueAtTime(28, detTime + 0.8);

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(800, detTime);
    subFilter.frequency.exponentialRampToValueAtTime(80, detTime + 0.8);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(1.5, detTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, detTime + 0.8);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(detTime);
    subOsc.stop(detTime + 0.85);
  }

  /**
   * Tactical Weapon Switch Click
   */
  public async playWeaponSwitch() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    this.scheduleMechanicalClick(t, 1100, 0.04, 0.4);
    this.scheduleMechanicalClick(t + 0.06, 750, 0.05, 0.5);
  }

  /**
   * Emergency Airburst:
   * Siren alert tone followed by massive thunderous compound detonation.
   */
  public async playAirburst() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Siren alarm sweep
    const siren = ctx.createOscillator();
    siren.type = 'sawtooth';
    siren.frequency.setValueAtTime(520, t);
    siren.frequency.linearRampToValueAtTime(980, t + 0.28);
    siren.frequency.linearRampToValueAtTime(450, t + 0.45);

    const sirenGain = ctx.createGain();
    sirenGain.gain.setValueAtTime(0.01, t);
    sirenGain.gain.linearRampToValueAtTime(0.7, t + 0.15);
    sirenGain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

    siren.connect(sirenGain);
    sirenGain.connect(this.masterGain);
    siren.start(t);
    siren.stop(t + 0.5);

    // Massive Detonation at t + 0.45s
    const detTime = t + 0.45;

    // 1. Deep Sub-bass Shockwave (220Hz down to 22Hz over 1.4s)
    const bombOsc = ctx.createOscillator();
    bombOsc.type = 'sawtooth';
    bombOsc.frequency.setValueAtTime(220, detTime);
    bombOsc.frequency.exponentialRampToValueAtTime(22, detTime + 1.4);

    const bombFilter = ctx.createBiquadFilter();
    bombFilter.type = 'lowpass';
    bombFilter.frequency.setValueAtTime(600, detTime);
    bombFilter.frequency.exponentialRampToValueAtTime(60, detTime + 1.4);

    const bombGain = ctx.createGain();
    bombGain.gain.setValueAtTime(1.8, detTime);
    bombGain.gain.exponentialRampToValueAtTime(0.001, detTime + 1.5);

    bombOsc.connect(bombFilter);
    bombFilter.connect(bombGain);
    bombGain.connect(this.masterGain);

    bombOsc.start(detTime);
    bombOsc.stop(detTime + 1.55);

    // 2. White noise debris explosion blast
    const noiseDuration = 0.8;
    const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.16));
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'lowpass';
    nFilter.frequency.setValueAtTime(2400, detTime);
    nFilter.frequency.exponentialRampToValueAtTime(200, detTime + noiseDuration);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(1.5, detTime);
    nGain.gain.exponentialRampToValueAtTime(0.001, detTime + noiseDuration);

    noiseSource.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.masterGain);

    noiseSource.start(detTime);
    noiseSource.stop(detTime + noiseDuration + 0.05);
  }

  /**
   * Heavy synthesized explosive barrel detonation sound:
   * Deep sub-bass blast (140Hz -> 38Hz) layered with violent fire combustion
   * and debris shrapnel noise decaying over 0.8s.
   */
  public async playExplosion() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.82;

    // 1. Deep Sub-bass Shockwave (140Hz dropping to 36Hz over 0.38s)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(36, t + 0.38);

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(500, t);
    subFilter.frequency.exponentialRampToValueAtTime(70, t + 0.38);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(1.6, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(t);
    subOsc.stop(t + 0.45);

    // 2. Violent Fire Combustion & Expanding Shockwave Noise
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.18));
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2400, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(180, t + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseSource.start(t);
    noiseSource.stop(t + duration + 0.05);

    // 3. Shrapnel metal transient snap
    const snapOsc = ctx.createOscillator();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(850, t);
    snapOsc.frequency.exponentialRampToValueAtTime(120, t + 0.06);
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.7, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    snapOsc.connect(snapGain);
    snapGain.connect(this.masterGain);
    snapOsc.start(t);
    snapOsc.stop(t + 0.08);
  }

  /**
   * Heavy Brute Zombie Roar / Sub-harmonic growl
   */
  public async playBruteRoar() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 1.2;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.linearRampToValueAtTime(42, t + duration * 0.6);
    osc.frequency.linearRampToValueAtTime(32, t + duration);

    const mod = ctx.createOscillator();
    mod.type = 'square';
    mod.frequency.setValueAtTime(14, t);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(30, t);
    mod.connect(modGain);
    modGain.connect(osc.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.7, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    mod.start(t);
    osc.start(t);
    mod.stop(t + duration);
    osc.stop(t + duration);
  }

  /**
   * Heavy Brute Stomp Footstep
   */
  public async playBruteStomp() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.21);
  }

  /**
   * Armory Shop Purchase Confirmation Chime
   */
  public async playBuyItem() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, t);
    osc1.frequency.setValueAtTime(1320, t + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc1.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc1.stop(t + 0.25);
  }

  /**
   * Adrenaline Auto-Stim Emergency Revive Effect
   * Pneumatic injector hiss + defibrillator electric surge + heroic ascending chords
   */
  public async playRevive() {
    if (!this.enabled) return;
    await this.ensureAudioContext();
    if (!this.ctx || !this.masterGain) return;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Pneumatic injection hiss (high-pressure medical needle)
    const noiseDuration = 0.35;
    const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1800, t);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDuration);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSource.start(t);

    // 2. Ascending heroic triad revival chords
    const chordFrequencies = [
      [220, 277.18, 329.63], // A major
      [329.63, 440, 554.37], // E -> A octave
      [554.37, 659.25, 880], // High triumphant surge
    ];

    chordFrequencies.forEach((chord, chordIdx) => {
      const chordTime = t + chordIdx * 0.12;
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = chordIdx === 2 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, chordTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.05, chordTime + 0.4);

        gain.gain.setValueAtTime(0.18, chordTime);
        gain.gain.exponentialRampToValueAtTime(0.001, chordTime + 0.45);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(chordTime);
        osc.stop(chordTime + 0.48);
      });
    });

    // 3. Sub-bass revitalizing defibrillator thud
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(160, t);
    bassOsc.frequency.exponentialRampToValueAtTime(45, t + 0.5);
    bassGain.gain.setValueAtTime(0.7, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    bassOsc.connect(bassGain);
    bassGain.connect(this.masterGain);
    bassOsc.start(t);
    bassOsc.stop(t + 0.56);
  }
}

export const soundManager = new SoundEngine();
