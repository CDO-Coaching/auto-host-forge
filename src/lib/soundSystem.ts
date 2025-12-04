// Système sonore élaboré pour les minuteurs
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

  // Son de décompte 3-2-1 (bips courts montants)
  countdown321(count: number) {
    if (!this.ctx) return;
    const freq = 800 + (count * 200); // 800, 1000, 1200 Hz
    const osc = this.createOscillator(freq, 'sine');
    const gain = this.createGain(0.4);
    
    if (!osc || !gain) return;
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Son GO ! (accord puissant)
  go() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Triple accord pour un son riche
    [400, 600, 800].forEach((freq, i) => {
      const osc = this.createOscillator(freq, 'triangle');
      const gain = this.createGain(0.25);
      
      if (!osc || !gain) return;
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      
      osc.start(now + i * 0.02);
      osc.stop(now + 0.4 + i * 0.02);
    });
  }

  // Alerte 5 secondes (série de bips rapides qui s'accélèrent)
  alert5Seconds() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const beeps = [0, 0.15, 0.3, 0.45, 0.55]; // Accélération progressive
    
    beeps.forEach((delay) => {
      const osc = this.createOscillator(1400, 'square');
      const gain = this.createGain(0.35);
      
      if (!osc || !gain) return;
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      
      const startTime = now + delay;
      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.08);
      
      osc.start(startTime);
      osc.stop(startTime + 0.08);
    });
  }

  // Son de transition (passage au tour suivant)
  transition() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Swoosh descendant + bip
    const osc1 = this.createOscillator(1200, 'sawtooth');
    const gain1 = this.createGain(0.2);
    
    if (!osc1 || !gain1) return;
    
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    
    osc1.frequency.exponentialRampToValueAtTime(600, now + 0.2);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc1.start(now);
    osc1.stop(now + 0.2);
    
    // Bip de confirmation après le swoosh
    setTimeout(() => {
      if (!this.ctx) return;
      const osc2 = this.createOscillator(800, 'sine');
      const gain2 = this.createGain(0.3);
      
      if (!osc2 || !gain2) return;
      
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      
      const startTime = this.ctx.currentTime;
      gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
      
      osc2.start(startTime);
      osc2.stop(startTime + 0.15);
    }, 200);
  }

  // Son de fin complète (mélodie de victoire)
  victory() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const melody = [
      { freq: 523, time: 0, duration: 0.15 },      // C
      { freq: 659, time: 0.15, duration: 0.15 },   // E
      { freq: 784, time: 0.3, duration: 0.3 },     // G
    ];
    
    melody.forEach(note => {
      const osc = this.createOscillator(note.freq, 'triangle');
      const gain = this.createGain(0.3);
      
      if (!osc || !gain) return;
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      
      const startTime = now + note.time;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.duration);
      
      osc.start(startTime);
      osc.stop(startTime + note.duration);
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
