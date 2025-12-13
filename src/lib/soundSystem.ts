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

  // Sifflet de départ de minute EMOM - SON UNIQUE ET PUISSANT
  emomMinuteStart() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Sifflet de coach : montée rapide puis descente (typique du sifflet de coach)
    const osc = this.createOscillator(1900, "sine");
    const gain = this.createGain(0.6);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Montée rapide puis descente caractéristique
    osc.frequency.setValueAtTime(1900, now);
    osc.frequency.linearRampToValueAtTime(2600, now + 0.1); // Montée
    osc.frequency.linearRampToValueAtTime(1700, now + 0.3); // Descente

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.35);
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
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Sifflet court et énergique de coach
    const osc = this.createOscillator(2100, "sine");
    const gain = this.createGain(0.6);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Montée rapide typique d'un sifflet
    osc.frequency.setValueAtTime(2100, now);
    osc.frequency.linearRampToValueAtTime(2600, now + 0.08);
    osc.frequency.linearRampToValueAtTime(2000, now + 0.2);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Double sifflet pour repos (10s) - REPOS !
  tabataRestStart() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Deux sifflets courts
    [0, 0.2].forEach((delay) => {
      const osc = this.createOscillator(1800, "sine");
      const gain = this.createGain(0.5);

      if (!osc || !gain) return;

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      const startTime = now + delay;
      // Sifflet court descendant
      osc.frequency.setValueAtTime(1800, startTime);
      osc.frequency.linearRampToValueAtTime(1500, startTime + 0.15);

      gain.gain.setValueAtTime(0.5, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.18);

      osc.start(startTime);
      osc.stop(startTime + 0.18);
    });
  }

  // Triple sifflet pour fin de Tabata - C'EST FINI !
  tabataComplete() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Trois sifflets montants (victoire)
    [0, 0.3, 0.6].forEach((delay, i) => {
      const baseFreq = 1800 + i * 200; // Montée progressive
      const osc = this.createOscillator(baseFreq, "sine");
      const gain = this.createGain(0.55);

      if (!osc || !gain) return;

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      const startTime = now + delay;
      // Sifflet montant
      osc.frequency.setValueAtTime(baseFreq, startTime);
      osc.frequency.linearRampToValueAtTime(baseFreq + 400, startTime + 0.12);
      osc.frequency.linearRampToValueAtTime(baseFreq + 200, startTime + 0.25);

      gain.gain.setValueAtTime(0.55, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.28);

      osc.start(startTime);
      osc.stop(startTime + 0.28);
    });
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
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Sifflet de coach puissant
    const osc = this.createOscillator(2000, "sine");
    const gain = this.createGain(0.65);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Sifflet : montée rapide puis descente
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.linearRampToValueAtTime(2800, now + 0.12);
    osc.frequency.linearRampToValueAtTime(1800, now + 0.35);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.setValueAtTime(0.65, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Sifflet de fin de workout
  workoutEnd() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Triple sifflet long (TEMPS ÉCOULÉ / WORKOUT TERMINÉ)
    [0, 0.35, 0.7].forEach((delay) => {
      const osc = this.createOscillator(2000, "sine");
      const gain = this.createGain(0.55);

      if (!osc || !gain) return;

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      const startTime = now + delay;
      // Sifflet descendant
      osc.frequency.setValueAtTime(2000, startTime);
      osc.frequency.linearRampToValueAtTime(1400, startTime + 0.3);

      gain.gain.setValueAtTime(0.55, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
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
    // Bips graves qui montent: 3 (grave), 2 (moyen), 1 (aigu)
    const freq = 800 + count * 200; // 800, 1000, 1200 Hz
    const osc = this.createOscillator(freq, "sine");
    const gain = this.createGain(0.45);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  // GO! après le 3-2-1 - Sifflet de coach sportif
  go() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Sifflet de coach : montée rapide et puissante
    const osc = this.createOscillator(2000, "sine");
    const gain = this.createGain(0.65);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // Sifflet typique : montée rapide puis descente
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.linearRampToValueAtTime(2800, now + 0.12); // Montée puissante
    osc.frequency.linearRampToValueAtTime(1800, now + 0.35); // Descente

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.setValueAtTime(0.65, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // ============================================
  // SONS GÉNÉRIQUES CONSERVÉS
  // ============================================

  // Son de transition (changement de phase)
  transition() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Sifflet modulé
    const osc = this.createOscillator(1600, "sine");
    const gain = this.createGain(0.45);

    if (!osc || !gain) return;

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.linearRampToValueAtTime(1800, now + 0.1);
    osc.frequency.linearRampToValueAtTime(1500, now + 0.25);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);
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
