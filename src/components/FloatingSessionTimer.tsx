import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

interface FloatingSessionTimerProps {
  sessionId: string;
}

export function FloatingSessionTimer({ sessionId }: FloatingSessionTimerProps) {
  const [duration, setDuration] = useState<number>(0);
  const [isActive, setIsActive] = useState(false);

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
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-mono text-lg font-semibold">
        <Timer className="h-5 w-5" />
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  );
}
