import { useEffect, useState, useRef } from "react";
import { Timer } from "lucide-react";

interface FloatingSessionTimerProps {
  sessionId: string;
  onClick?: () => void;
}

export function FloatingSessionTimer({ sessionId, onClick }: FloatingSessionTimerProps) {
  const [duration, setDuration] = useState<number>(0);
  const [isActive, setIsActive] = useState(false);
  const prevActiveRef = useRef(false);
  // Animation d'apparition : gros au centre puis rejoint le coin bas-droite
  const [intro, setIntro] = useState<null | "big" | "settle">(null);

  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      prevActiveRef.current = true;
      setIntro("big");
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setIntro("settle")));
      const t = setTimeout(() => setIntro(null), 1100);
      return () => { cancelAnimationFrame(r); clearTimeout(t); };
    }
    if (!isActive) prevActiveRef.current = false;
  }, [isActive]);

  useEffect(() => {
    const checkTimer = () => {
      const savedTimer = localStorage.getItem(`session_timer_${sessionId}`);
      if (savedTimer) {
        const { startTime, isActive: active } = JSON.parse(savedTimer);
        if (active) {
          setIsActive(true);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setDuration(elapsed);
        } else {
          setIsActive(false);
        }
      } else {
        setIsActive(false);
      }
    };

    // Check immediately
    checkTimer();

    // Update every second
    const interval = setInterval(checkTimer, 1000);

    return () => clearInterval(interval);
  }, [sessionId]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isActive) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <button
        type="button"
        onClick={onClick}
        className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 font-mono text-sm font-semibold"
        style={
          intro
            ? {
                transform: intro === "big" ? "translate(-38vw, -40vh) scale(3.2)" : "none",
                transition: intro === "big" ? "none" : "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
              }
            : { transition: "transform 150ms" }
        }
        title="Terminer la séance"
      >
        <Timer className="h-3.5 w-3.5" />
        <span>{formatDuration(duration)}</span>
      </button>
    </div>
  );
}
