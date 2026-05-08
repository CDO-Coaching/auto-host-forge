import { useState, useRef, useCallback } from "react";

export type VoiceState = "idle" | "listening" | "processing";

interface UseVoiceCommandReturn {
  state: VoiceState;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
}

export function useVoiceCommand(
  onResult: (finalTranscript: string) => void,
): UseVoiceCommandReturn {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const accumulatedRef = useRef<string>("");
  // Flag explicite : true = arrêt volontaire, false = arrêt inattendu (silence long)
  const isManualStopRef = useRef<boolean>(false);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognition;

  /** Arrête l'enregistrement et envoie le transcript accumulé */
  const stopListening = useCallback(() => {
    isManualStopRef.current = true; // ← marquer AVANT stop() pour que onend ne relance pas

    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) rec.stop();

    const final = accumulatedRef.current.trim();
    setInterimTranscript("");

    if (final) {
      setState("processing");
      setTranscript(final);
      onResult(final);
    } else {
      setState("idle");
    }
  }, [onResult]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Reconnaissance vocale non supportée (utilisez Chrome)");
      return;
    }

    setError(null);
    setTranscript("");
    setInterimTranscript("");
    accumulatedRef.current = "";
    isManualStopRef.current = false; // ← reset du flag à chaque nouveau démarrage

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          accumulatedRef.current += (accumulatedRef.current ? " " : "") + t.trim();
        } else {
          interim += t;
        }
      }
      const display = [accumulatedRef.current, interim].filter(Boolean).join(" ");
      setInterimTranscript(display);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return; // silences normaux en mode continu
      if (event.error === "not-allowed") {
        setError("Micro non autorisé — autorise l'accès dans ton navigateur");
      } else {
        setError(`Erreur micro : ${event.error}`);
      }
      setState("idle");
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      // Relancer seulement si l'arrêt n'était PAS volontaire (ex: silence Chrome)
      if (!isManualStopRef.current && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (_) {}
      }
    };

    recognition.start();
  }, [SpeechRecognition]);

  const reset = useCallback(() => {
    isManualStopRef.current = true;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) rec.stop();

    accumulatedRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setError(null);
    setState("idle");
  }, []);

  return { state, transcript, interimTranscript, error, isSupported, startListening, stopListening, reset };
}
