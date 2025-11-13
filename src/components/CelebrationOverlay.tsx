import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { Trophy, Star, X } from "lucide-react";

interface CelebrationOverlayProps {
  show: boolean;
  message: string;
  onComplete: () => void;
  type?: "exercise" | "session";
}

const encouragementMessages = {
  exercise: [
    "Bravo ! 💪",
    "Excellent ! 🔥",
    "Super travail ! ⚡",
    "Continue ! 💯",
    "Bien joué ! 🎯",
  ],
  session: [
    "Séance terminée ! 🎉",
    "Félicitations ! 🏆",
    "Incroyable ! 🌟",
    "Tu assures ! 💪",
    "Champion ! 👏",
  ],
};

export function CelebrationOverlay({ show, message, onComplete, type = "exercise" }: CelebrationOverlayProps) {
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (show) {
      startTimeRef.current = Date.now();
      
      // Utiliser requestAnimationFrame pour plus de fiabilité sur mobile
      const checkAndClose = () => {
        const elapsed = Date.now() - startTimeRef.current;
        if (elapsed >= 2000) {
          onComplete();
        } else {
          timerRef.current = requestAnimationFrame(checkAndClose);
        }
      };
      
      timerRef.current = requestAnimationFrame(checkAndClose);
      
      return () => {
        if (timerRef.current) {
          cancelAnimationFrame(timerRef.current);
        }
      };
    }
  }, [show, onComplete]);

  const randomMessage = encouragementMessages[type][Math.floor(Math.random() * encouragementMessages[type].length)];

  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-sm"
          onClick={onComplete}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ 
              scale: [0.5, 1.2, 1],
              opacity: 1,
              rotate: [0, 10, -10, 0]
            }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ 
              duration: 0.6,
              ease: "easeOut"
            }}
            className="relative"
          >
            {/* Cercles d'animation en arrière-plan */}
            <motion.div
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full blur-2xl"
            />
            
            {/* Carte principale */}
            <div className="relative bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 p-8 rounded-3xl shadow-2xl text-center min-w-[280px]">
              {/* Bouton de fermeture visible */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete();
                }}
                className="absolute top-2 right-2 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                aria-label="Fermer"
              >
                <X className="h-5 w-5 text-white" />
              </button>
              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                  rotate: [0, 360]
                }}
                transition={{ 
                  duration: 0.8,
                  repeat: 1
                }}
                className="mb-4 flex justify-center"
              >
                {type === "session" ? (
                  <Trophy className="h-16 w-16 text-white drop-shadow-lg" />
                ) : (
                  <Star className="h-16 w-16 text-white drop-shadow-lg" />
                )}
              </motion.div>
              
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-black text-white mb-2 drop-shadow-lg"
              >
                {randomMessage}
              </motion.h2>
              
              {message && (
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg font-semibold text-white/90"
                >
                  {message}
                </motion.p>
              )}

              {/* Étoiles animées */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: [0, 1.5, 0],
                    opacity: [0, 1, 0],
                    y: [0, -50],
                    x: [(i - 1) * 30, (i - 1) * 60]
                  }}
                  transition={{ 
                    duration: 1.5,
                    delay: i * 0.2,
                    ease: "easeOut"
                  }}
                  className="absolute top-4"
                  style={{ left: `${30 + i * 20}%` }}
                >
                  <Star className="h-6 w-6 text-white" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
