import { motion, AnimatePresence } from "framer-motion";
import { Trophy, X, Sparkles } from "lucide-react";
import { ConfettiEffect } from "./ConfettiEffect";

interface WeeklyCompletionCelebrationProps {
  show: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export function WeeklyCompletionCelebration({
  show,
  title,
  message,
  onClose,
}: WeeklyCompletionCelebrationProps) {
  if (!show) return null;

  return (
    <>
      <ConfettiEffect show={show} />
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 15, stiffness: 300 }}
              className="relative bg-gradient-to-br from-primary/20 via-background to-primary/10 border-2 border-primary/50 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-primary/20"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-primary/20 transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>

              {/* Trophy icon with glow */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", damping: 10 }}
                className="flex justify-center mb-4"
              >
                <div className="relative">
                  <div className="absolute inset-0 blur-2xl bg-primary/40 rounded-full" />
                  <div className="relative bg-gradient-to-br from-primary to-primary/60 p-4 rounded-full">
                    <Trophy className="h-12 w-12 sm:h-16 sm:w-16 text-primary-foreground" />
                  </div>
                </div>
              </motion.div>

              {/* Sparkles decoration */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="absolute top-6 left-6"
              >
                <Sparkles className="h-5 w-5 text-primary/60" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute top-10 right-10"
              >
                <Sparkles className="h-4 w-4 text-primary/40" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="absolute bottom-12 left-8"
              >
                <Sparkles className="h-3 w-3 text-primary/50" />
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl sm:text-3xl font-bold text-center mb-3 bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent"
              >
                {title}
              </motion.h2>

              {/* Message */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-center text-muted-foreground text-sm sm:text-base mb-6"
              >
                {message}
              </motion.p>

              {/* Continue button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full py-3 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-colors shadow-lg shadow-primary/30"
              >
                Continuer 💪
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
