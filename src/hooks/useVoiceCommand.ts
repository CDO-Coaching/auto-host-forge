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
  // Accumule tous les segments finaux depuis le début de l'enregistrement
  const accumulatedRef = useRef<string>("");

  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognition;

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

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

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = "fr-FR";
    recognition.continuous = true;      // ← ne s'arrête pas aux silences
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // Ajouter au transcript accumulé
          accumulatedRef.current += (accumulatedRef.current ? " " : "") + t.trim();
        } else {
          interim += t;
        }
      }
      // Afficher : tout ce qui est déjà confirmé + ce qui est en cours
      const display = [accumulatedRef.current, interim].filter(Boolean).join(" ");
      setInterimTranscript(display);
    };

    recognition.onerror = (event: any) => {
      // En mode continu, "no-speech" est normal (silences) → on ignore
      if (event.error === "no-speech") return;
      if (event.error === "not-allowed") {
        setError("Micro non autorisé — autorise l'accès dans ton navigateur");
        setState("idle");
      } else {
        setError(`Erreur : ${event.error}`);
        setState("idle");
      }
    };

    recognition.onend = () => {
      // En mode continu, le navigateur peut couper après un long silence
      // → relancer automatiquement si on est toujours en mode "listening"
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (_) {}
      }
    };

    recognition.start();
  }, [SpeechRecognition]);

  const reset = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    accumulatedRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setError(null);
    setState("idle");
  }, []);

  return {
    state,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    reset,
  };
}
