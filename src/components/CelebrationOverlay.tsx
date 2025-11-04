import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface CelebrationOverlayProps {
  show: boolean;
  message: string;
  onComplete: () => void;
}

export function CelebrationOverlay({ show, message, onComplete }: CelebrationOverlayProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => onComplete(), 1800);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/60"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-yellow-400 text-black font-bold text-3xl px-8 py-6 rounded-2xl shadow-lg"
          >
            {message} 💪
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
