// Système sonore des minuteurs — palette douce et musicale (synthèse Web Audio).
// Tonalités rondes (sine/triangle), attaques douces, fréquences modérées pour
// rester agréables au casque. API publique inchangée (utilisée par useUniversalTimer).
export type SoundPreset = "gym" | "soft";

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private preset: SoundPreset = "gym";
  private clips: Record<string, HTMLAudioElement> = {};

  constructor(preset: SoundPreset = "gym") {
    this.preset = preset;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error("AudioContext not supported:", error);
    }
    this.preloadClips();
  }

  private preloadClips() {
    if (typeof Audio === "undefined") return;
    const files: Record<string, string> = {
      start: "/sounds/timer-start.m4a",
      half: "/sounds/timer-half.m4a",
      end: "/sounds/timer-end.m4a",
    };
    for (const [key, src] of Object.entries(files)) {
      try {
        const a = new Audio(src);
        a.preload = "auto";
        a.load();
        this.clips[key] = a;
      } catch {}
    }
  }

  /** Joue un enregistrement. Renvoie true si la lecture a été lancée. */
  private playClip(key: string): boolean {
    const clip = this.clips[key];
    if (!clip) return false;
    try {
      clip.currentTime = 0;
      const p = clip.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  setPreset(preset: SoundPreset) {
    this.preset = preset;
  }

  private resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Une note propre : attaque douce, léger sustain, décroissance naturelle.
   * @param freq fréquence en Hz
   * @param delay départ (s) relatif à maintenant
   * @param duration durée totale (s)
   * @param peak volume crête (0-1)
   * @param type forme d'onde
   */
  private tone(freq: number, delay: number, duration: number, peak = 0.28, type: OscillatorType = "sine") {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    // Un peu de rondeur : filtre passe-bas doux
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = Math.max(freq * 3, 2000);

    const gain = this.ctx.createGain();
    const attack = 0.012;
    const release = Math.min(0.25, duration * 0.6);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + attack);
    gain.gain.setValueAtTime(peak, now + Math.max(attack, duration - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Petite descente/montée "chime" à deux notes.
  private chime(f1: number, f2: number, peak = 0.26) {
    this.tone(f1, 0, 0.16, peak, "sine");
    this.tone(f2, 0.14, 0.28, peak, "sine");
  }

  // Accord arpégé montant (satisfaisant, non strident).
  private arpUp(peak = 0.26) {
    // Do - Mi - Sol (C5, E5, G5)
    this.tone(523.25, 0, 0.18, peak, "sine");
    this.tone(659.25, 0.16, 0.18, peak, "sine");
    this.tone(783.99, 0.32, 0.42, peak, "triangle");
  }

  // ============================================
  // COMPTE À REBOURS 3-2-1 / GO
  // ============================================

  // Bips de préparation : chauds, ronds, même hauteur (pas montants stridents).
  countdown321(_count: number) {
    this.resume();
    if (this.preset === "gym") {
      // Style minuteur de salle : bip court, sec, hauteur fixe (~800 Hz).
      this.tone(800, 0, 0.11, 0.3, "square");
      return;
    }
    this.tone(660, 0, 0.18, 0.24, "sine"); // Mi5 doux
  }

  /** Un enregistrement est-il disponible pour cette clé ? */
  hasClip(key: string): boolean {
    return !!this.clips[key];
  }

  /**
   * Débloque les enregistrements pour iOS : à appeler dans un geste utilisateur
   * (ex. appui sur démarrer). Lecture muette instantanée puis pause, ce qui
   * autorise la lecture ultérieure (notamment le son de fin, loin d'un tap).
   */
  primeClips() {
    for (const clip of Object.values(this.clips)) {
      try {
        clip.muted = true;
        const p = clip.play();
        if (p && typeof p.then === "function") {
          p.then(() => {
            clip.pause();
            clip.currentTime = 0;
            clip.muted = false;
          }).catch(() => {
            clip.muted = false;
          });
        } else {
          clip.pause();
          clip.currentTime = 0;
          clip.muted = false;
        }
      } catch {
        clip.muted = false;
      }
    }
  }

  /** Joue l'enregistrement de départ (au décompte). */
  startCue() {
    this.resume();
    this.playClip("start");
  }

  // GO ! — synthèse (l'enregistrement de départ, s'il existe, est joué au décompte).
  go() {
    this.resume();
    if (this.preset === "gym") {
      // Le "BIIIP" final, plus long et plus haut que les 3 bips.
      this.tone(1000, 0, 0.5, 0.32, "square");
      return;
    }
    this.tone(880, 0, 0.35, 0.3, "triangle"); // La5
  }

  // ============================================
  // TRANSITIONS / FIN
  // ============================================

  // Bip court "digital" (style minuteur de salle).
  private gymBeep(delay = 0, freq = 800, dur = 0.11, peak = 0.3) {
    this.tone(freq, delay, dur, peak, "square");
  }

  // Changement de phase — chime doux (soft) ou double bip sec (gym).
  transition() {
    this.resume();
    if (this.preset === "gym") {
      this.gymBeep(0, 800);
      this.gymBeep(0.16, 1000, 0.16);
      return;
    }
    this.chime(784, 588, 0.24);
  }

  // Fin / victoire — enregistrement de fin si dispo, sinon synthèse.
  victory() {
    this.resume();
    if (this.playClip("end")) return;
    if (this.preset === "gym") {
      this.gymBeep(0, 800);
      this.gymBeep(0.18, 800);
      this.gymBeep(0.36, 800);
      this.tone(1000, 0.56, 0.6, 0.34, "square");
      return;
    }
    this.arpUp(0.28);
  }

  workoutEnd() {
    this.victory();
  }

  workoutStart() {
    this.resume();
    this.chime(523, 784, 0.28); // montée Do → Sol
  }

  // ============================================
  // ALERTES (adoucies, fréquences modérées)
  // ============================================

  alert5Seconds() {
    this.resume();
    // 3 petits bips doux espacés
    [0, 0.28, 0.56].forEach((d) => this.tone(720, d, 0.12, 0.2, "sine"));
  }

  amrapWarning1Min() {
    this.resume();
    [0, 0.2, 0.4].forEach((d) => this.tone(680, d, 0.12, 0.2, "sine"));
  }

  warning30s() {
    this.resume();
    this.chime(680, 760, 0.2);
  }

  warning10s() {
    this.resume();
    this.tone(760, 0, 0.14, 0.22, "sine");
  }

  // ============================================
  // EMOM
  // ============================================

  emomMinuteStart() {
    this.resume();
    if (this.preset === "gym") {
      this.tone(1000, 0, 0.4, 0.32, "square"); // top de minute franc
      return;
    }
    this.chime(660, 880, 0.28); // top de minute clair mais doux
  }

  emomWarning10s() {
    this.resume();
    this.tone(720, 0, 0.14, 0.2, "sine");
  }

  // ============================================
  // TABATA / HIIT (plus énergiques, restent ronds)
  // ============================================

  tabataWorkStart() {
    this.resume();
    if (this.preset === "gym") {
      this.tone(1000, 0, 0.4, 0.32, "square"); // départ travail franc
      return;
    }
    // Deux notes montantes toniques (triangle = plus de peps)
    this.tone(587, 0, 0.14, 0.3, "triangle");
    this.tone(880, 0.13, 0.26, 0.3, "triangle");
  }

  tabataRestStart() {
    this.resume();
    if (this.preset === "gym") {
      this.gymBeep(0, 700, 0.16);
      this.gymBeep(0.18, 550, 0.2);
      return;
    }
    // Deux notes descendantes = relâche
    this.tone(660, 0, 0.16, 0.26, "sine");
    this.tone(440, 0.16, 0.3, 0.26, "sine");
  }

  tabataComplete() {
    this.arpUp(0.3);
  }

  tabataWarning3s() {
    this.resume();
    this.tone(740, 0, 0.1, 0.22, "sine");
  }

  // Signal "moitié du travail" : enregistrement si dispo, sinon voix "half".
  half() {
    this.resume();
    if (this.playClip("half")) return;
    this.tone(660, 0, 0.12, 0.22, "sine");
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance("half");
        u.lang = "en-US";
        u.rate = 1;
        u.volume = 1;
        window.speechSynthesis.speak(u);
      }
    } catch {}
  }

  // ============================================
  // GÉNÉRIQUE
  // ============================================

  beep(frequency: number, duration: number) {
    this.resume();
    this.tone(frequency, 0, duration / 1000, 0.24, "sine");
  }

  close() {
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
