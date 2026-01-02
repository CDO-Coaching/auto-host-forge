import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
}

const colors = [
  "hsl(var(--primary))",
  "#FFD700",
  "#FF6B6B",
  "#4ECDC4",
  "#A855F7",
  "#F97316",
  "#10B981",
];

export function ConfettiEffect({ show }: { show: boolean }) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (show) {
      const pieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
      }));
      setConfetti(pieces);
    } else {
      setConfetti([]);
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {confetti.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{ 
            x: `${piece.x}vw`, 
            y: -20,
            rotate: 0,
            opacity: 1 
          }}
          animate={{ 
            y: "110vh",
            rotate: piece.rotation + 720,
            opacity: [1, 1, 0]
          }}
          transition={{ 
            duration: piece.duration,
            delay: piece.delay,
            ease: "easeIn"
          }}
          style={{
            position: "absolute",
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
          }}
        />
      ))}
    </div>
  );
}
