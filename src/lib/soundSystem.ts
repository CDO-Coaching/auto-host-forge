// Système sonore sportif pour les minuteurs - Style buzzer de gym
export class SoundSystem {
  private ctx: AudioContext | null = null;

  constructor() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('AudioContext not supported:', error);
    }
  }

  private createOscillator(freq: number, type: OscillatorType = 'sine'): OscillatorNode | null {
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

  // Son de décompte 3-2-1 (bips sportifs graves)
  countdown321(count: number) {
    if (!this.ctx) return;
    // Fréquences plus basses et sportives
    const freq = 300 + (count * 100); // 300, 400, 500 Hz - plus grave
    const osc = this.createOscillator(freq, 'square');
    const gain = this.createGain(0.5);
    const filter = this.createBiquadFilter('lowpass', 800);
    
    if (!osc || !gain || !filter) return;
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Son GO ! (klaxon de départ sportif)
  go() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Double klaxon grave style départ de course
    [220, 330, 440].forEach((freq, i) => {
      const osc = this.createOscillator(freq, 'sawtooth');
      const gain = this.createGain(0.4);
      const filter = this.createBiquadFilter('lowpass', 1000);
      
      if (!osc || !gain || !filter) return;
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx!.destination);
      
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      
      osc.start(now + i * 0.01);
      osc.stop(now + 0.5 + i * 0.01);
    });
  }

  // Alerte 5 secondes (buzzer d'avertissement sportif)
  alert5Seconds() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Buzzer grave pulsé
    const beeps = [0, 0.12, 0.24, 0.36, 0.48];
    
    beeps.forEach((delay) => {
      const osc = this.createOscillator(350, 'sawtooth');
      const osc2 = this.createOscillator(352, 'sawtooth'); // Légère dissonance pour effet buzzer
      const gain = this.createGain(0.45);
      const filter = this.createBiquadFilter('lowpass', 600);
      
      if (!osc || !osc2 || !gain || !filter) return;
      
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx!.destination);
      
      const startTime = now + delay;
      gain.gain.setValueAtTime(0.45, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
      
      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + 0.1);
      osc2.stop(startTime + 0.1);
    });
  }

  // Son de transition PUISSANT (buzzer de gym pour changement de phase)
  transition() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Buzzer de gym grave et puissant - style klaxon de match
    const frequencies = [200, 250, 300];
    frequencies.forEach((freq) => {
      const osc = this.createOscillator(freq, 'sawtooth');
      const osc2 = this.createOscillator(freq * 1.01, 'sawtooth'); // Effet riche
      const gain = this.createGain(0.6);
      const filter = this.createBiquadFilter('lowpass', 800);
      
      if (!osc || !osc2 || !gain || !filter) return;
      
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx!.destination);
      
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.setValueAtTime(0.6, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      
      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.5);
      osc2.stop(now + 0.5);
    });
    
    // Deuxième coup de buzzer pour confirmer
    setTimeout(() => {
      if (!this.ctx) return;
      const osc = this.createOscillator(280, 'sawtooth');
      const osc2 = this.createOscillator(282, 'sawtooth');
      const gain = this.createGain(0.5);
      const filter = this.createBiquadFilter('lowpass', 700);
      
      if (!osc || !osc2 || !gain || !filter) return;
      
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx!.destination);
      
      const startTime = this.ctx!.currentTime;
      gain.gain.setValueAtTime(0.5, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      
      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + 0.3);
      osc2.stop(startTime + 0.3);
    }, 200);
  }

  // Son de fin complète (fanfare de victoire sportive)
  victory() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Fanfare sportive grave et puissante
    const melody = [
      { freq: 262, time: 0, duration: 0.2 },      // C grave
      { freq: 330, time: 0.15, duration: 0.2 },   // E
      { freq: 392, time: 0.3, duration: 0.4 },    // G
      { freq: 523, time: 0.5, duration: 0.5 },    // C aigu - final
    ];
    
    melody.forEach(note => {
      const osc = this.createOscillator(note.freq, 'sawtooth');
      const osc2 = this.createOscillator(note.freq * 2, 'triangle'); // Harmonique
      const gain = this.createGain(0.4);
      const filter = this.createBiquadFilter('lowpass', 1200);
      
      if (!osc || !osc2 || !gain || !filter) return;
      
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx!.destination);
      
      const startTime = now + note.time;
      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.duration);
      
      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + note.duration);
      osc2.stop(startTime + note.duration);
    });
  }

  // Beep simple (pour milieu de parcours ou alertes personnalisées)
  beep(frequency: number, duration: number) {
    if (!this.ctx) return;
    const osc = this.createOscillator(frequency, 'sine');
    const gain = this.createGain(0.25);
    
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
