// Système sonore sportif pour les minuteurs - Style coach de CrossFit/HIIT
export class SoundSystem {
  private ctx: AudioContext | null = null;

  constructor() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error("AudioContext not supported:", error);
    }
  }

  private createOscillator(freq: number, type: OscillatorType = "sine"): OscillatorNode | null {
    if (!this.ctx) return null;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    return osc;
  }

  private createGain(initialGain: number = 0.3): GainNode | null {
    if (!this.ctx) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = initialGain;
    return gain;
  }

  private createBiquadFilter(type: BiquadFilterType, freq: number): BiquadFilterNode | null {
    if (!this.ctx) return null;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    return filter;
  }

  // ============================================
  // SONS POUR EMOM (Every Minute On the Minute)
  // ============================================

  // Sifflet d'arbitre réaliste avec trille
  private playWhistle(duration: number = 0.5, intensity: number = 0.6) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Oscillateur principal - fréquence haute caractéristique du sifflet
    const osc1 = this.createOscillator(3200, "sine");
    const osc2 = this.createOscillator(6400, "sine"); // Harmonique
    const lfo = this.createOscillator(25, "sine"); // Trille/vibrato rapide
    const lfoGain = this.ctx.createGain();
    const gain1 = this.createGain(intensity);
    const gain2 = this.createGain(intensity * 0.3);

    if (!osc1 || !osc2 || !lfo || !gain1 || !gain2) return;

    // Modulation de fréquence pour le trille du sifflet
    lfo.connect(lfoGain);
    lfoGain.gain.value = 150; // Amplitude de la modulation
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(this.ctx.destination);
    gain2.connect(this.ctx.destination);

    // Enveloppe du sifflet - attaque rapide, sustain, release
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(intensity, now + 0.02);
    gain1.gain.setValueAtTime(intensity, now + duration - 0.1);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + duration);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(intensity * 0.3, now + 0.02);
    gain2.gain.setValueAtTime(intensity * 0.3, now + duration - 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + duration);

    lfo.start(now);
    osc1.start(now);
    osc2.start(now);
    lfo.stop(now + duration);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  // Sifflet de départ de minute EMOM - SON UNIQUE ET PUISSANT
  emomMinuteStart() {
    this.playWhistle(0.5, 0.65);
  }

  // Alerte 10 secondes avant la prochaine minute EMOM
  emomWarning10s() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Court bip aigu
    const osc = this.createOscillator(1200, "sine");
    const gain = this.createGain(0.3);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // ============================================
  // SONS POUR TABATA (20s/10s)
  // ============================================

  // Sifflet de départ de travail (20s) - TRAVAILLE !
  tabataWorkStart() {
    this.playWhistle(0.3, 0.65);
  }

  // Double sifflet pour repos (10s) - REPOS !
  tabataRestStart() {
    this.playWhistle(0.2, 0.5);
    setTimeout(() => this.playWhistle(0.2, 0.5), 250);
  }

  // Triple sifflet pour fin de Tabata - C'EST FINI !
  tabataComplete() {
    this.playWhistle(0.3, 0.55);
    setTimeout(() => this.playWhistle(0.3, 0.55), 350);
    setTimeout(() => this.playWhistle(0.4, 0.6), 700);
  }

  // Alerte 3 secondes avant fin de période
  tabataWarning3s() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Bip rapide
    const osc = this.createOscillator(1600, "sine");
    const gain = this.createGain(0.3);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // ============================================
  // SONS POUR AMRAP / FOR TIME
  // ============================================

  // Sifflet de départ de workout (AMRAP/FOR TIME)
  workoutStart() {
    this.playWhistle(0.5, 0.7);
  }

  // Sifflet de fin de workout - Triple sifflet long
  workoutEnd() {
    // Triple sifflet (TEMPS ÉCOULÉ / WORKOUT TERMINÉ)
    this.playWhistle(0.4, 0.6);
    setTimeout(() => this.playWhistle(0.4, 0.6), 450);
    setTimeout(() => this.playWhistle(0.5, 0.65), 900);
  }

  // Alerte 1 minute restante (AMRAP)
  amrapWarning1Min() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Série de 3 bips rapides
    [0, 0.15, 0.3].forEach((delay) => {
      const osc = this.createOscillator(1500, "sine");
      const gain = this.createGain(0.4);

      if (!osc || !gain) return;

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      const startTime = now + delay;
      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);

      osc.start(startTime);
      osc.stop(startTime + 0.12);
    });
  }

  // Alerte 30 secondes restantes
  warning30s() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Double bip montant
    [0, 0.18].forEach((delay, i) => {
      const freq = 1400 + i * 150;
      const osc = this.createOscillator(freq, "sine");
      const gain = this.createGain(0.4);

      if (!osc || !gain) return;

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      const startTime = now + delay;
      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  // Alerte 10 secondes restantes
  warning10s() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Bip unique aigu
    const osc = this.createOscillator(1700, "sine");
    const gain = this.createGain(0.35);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ============================================
  // SONS DE COMPTE À REBOURS (3-2-1)
  // ============================================

  // Compte à rebours 3-2-1 avant départ
  countdown321(count: number) {
    if (!this.ctx) return;
    // Bips courts qui montent
    const freq = 1200 + count * 300;
    const osc = this.createOscillator(freq, "sine");
    const gain = this.createGain(0.45);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // GO! après le 3-2-1 - Sifflet d'arbitre
  go() {
    this.playWhistle(0.5, 0.7);
  }

  // ============================================
  // SONS GÉNÉRIQUES CONSERVÉS
  // ============================================

  // Son de transition (changement de phase) - Sifflet
  transition() {
    this.playWhistle(0.35, 0.5);
  }

  // Son de victoire (workout complété)
  victory() {
    this.workoutEnd();
  }

  // Alerte générique 5 secondes
  alert5Seconds() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 5 bips rapides
    for (let i = 0; i < 5; i++) {
      const osc = this.createOscillator(1500, "sine");
      const gain = this.createGain(0.3);

      if (!osc || !gain) return;

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const startTime = now + i * 0.2;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

      osc.start(startTime);
      osc.stop(startTime + 0.1);
    }
  }

  // Beep personnalisé
  beep(frequency: number, duration: number) {
    if (!this.ctx) return;
    const osc = this.createOscillator(frequency, "sine");
    const gain = this.createGain(0.3);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);

    osc.start(now);
    osc.stop(now + duration / 1000);
  }

  // Fermer le contexte audio
  close() {
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
