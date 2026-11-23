// Session audio iOS — empêche les sons de l'app (bips de minuteur, voix,
// drones de méditation…) de COUPER la musique de fond (Spotify, Apple Music,
// podcasts…).
//
// Contexte : l'app est une PWA web. Par défaut, dès qu'une page web joue un son
// via l'API Web Audio ou un élément <audio>, iOS bascule la session audio du
// téléphone dans une catégorie « solo » qui interrompt toute autre lecture.
// iOS Safari 16.4+ expose `navigator.audioSession.type` pour choisir un autre
// comportement. En mode « transient », les sons courts de l'app se MÉLANGENT à
// la musique (léger ducking le temps du bip) au lieu de la couper, tout en
// restant audibles même quand d'autres applis jouent du son.
//
// Sans effet (silencieux) sur les navigateurs qui n'exposent pas l'API.

export type AudioSessionType =
  | "auto"
  | "playback"
  | "transient"
  | "transient-solo"
  | "ambient"
  | "play-and-record";

/** Définit le type de session audio de la page, si l'API est disponible. */
export function setAudioSessionType(type: AudioSessionType): void {
  try {
    const nav = navigator as unknown as { audioSession?: { type?: string } };
    if (nav?.audioSession && "type" in nav.audioSession) {
      nav.audioSession.type = type;
    }
  } catch {
    /* API indisponible ou refusée : on ignore */
  }
}

/**
 * Mode recommandé pour les sons de l'app : audibles par-dessus la musique de
 * fond, sans l'interrompre. À appeler tôt (démarrage de l'app) et juste avant
 * de créer un AudioContext / de jouer un son, car c'est idempotent.
 */
export function enableMixableAudioSession(): void {
  setAudioSessionType("transient");
}
