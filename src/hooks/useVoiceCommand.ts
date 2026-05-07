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
  onResult: (finalTranscript: string) => void
): UseVoiceCommandReturn {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

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
    setState("idle");
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Reconnaissance vocale non supportée (utilisez Chrome)");
      return;
    }

    setError(null);
    setTranscript("");
    setInterimTranscript("");

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) setInterimTranscript(interim);
      if (final) {
        setTranscript(final);
        setInterimTranscript("");
        setState("processing");
        onResult(final);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        setError("Aucune parole détectée — réessaie");
      } else if (event.error === "not-allowed") {
        setError("Micro non autorisé — autorise l'accès dans ton navigateur");
      } else {
        setError(`Erreur : ${event.error}`);
      }
      setState("idle");
    };

    recognition.onend = () => {
      if (state === "listening") setState("idle");
      setInterimTranscript("");
    };

    recognition.start();
  }, [SpeechRecognition, onResult]);

  const reset = useCallback(() => {
    stopListening();
    setTranscript("");
    setInterimTranscript("");
    setError(null);
    setState("idle");
  }, [stopListening]);

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
