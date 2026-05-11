import { useState, useRef, useCallback } from "react";

export type VoiceState = "idle" | "listening" | "processing";

interface UseVoiceCommandReturn {
  state: VoiceState;
  transcript: string;
  /** Texte confirmé (finalisé par la reconnaissance) — éditable via updateAccumulated */
  accumulated: string;
  /** Texte en cours de reconnaissance (non finalisé) */
  interimHint: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  /** Permet d'éditer manuellement le texte accumulé pendant l'enregistrement */
  updateAccumulated: (text: string) => void;
  reset: () => void;
  // Kept for backward compat
  interimTranscript: string;
}

export function useVoiceCommand(
  onResult: (finalTranscript: string) => void,
): UseVoiceCommandReturn {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [accumulated, setAccumulated] = useState("");
  const [interimHint, setInterimHint] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const accumulatedRef = useRef<string>("");
  const isManualStopRef = useRef<boolean>(false);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognition;

  const updateAccumulated = useCallback((text: string) => {
    accumulatedRef.current = text;
    setAccumulated(text);
  }, []);

  const stopListening = useCallback(() => {
    isManualStopRef.current = true;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) rec.stop();

    const final = accumulatedRef.current.trim();
    setInterimHint("");

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
    setAccumulated("");
    setInterimHint("");
    accumulatedRef.current = "";
    isManualStopRef.current = false;

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
          setAccumulated(accumulatedRef.current);
        } else {
          interim += t;
        }
      }
      setInterimHint(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return;
      if (event.error === "not-allowed") {
        setError("Micro non autorisé — autorise l'accès dans ton navigateur");
      } else {
        setError(`Erreur micro : ${event.error}`);
      }
      setState("idle");
      recognitionRef.current = null;
    };

    recognition.onend = () => {
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
    setAccumulated("");
    setInterimHint("");
    setError(null);
    setState("idle");
  }, []);

  // interimTranscript kept for backward compat (accumulated + hint)
  const interimTranscript = [accumulated, interimHint].filter(Boolean).join(" ");

  return {
    state, transcript, accumulated, interimHint,
    interimTranscript, error, isSupported,
    startListening, stopListening, updateAccumulated, reset,
  };
}
