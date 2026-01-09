import { useState, useEffect, useCallback } from "react";

const WEEKLY_CELEBRATION_KEY = "weekly_completion_celebrated";

const weeklyMessages = [
  { title: "Semaine parfaite ! 🏆", message: "Tu as terminé toutes tes séances, quelle discipline !" },
  { title: "Champion ! 💪", message: "100% des séances complétées. Continue sur cette lancée !" },
  { title: "Objectif atteint ! 🎯", message: "Toutes les séances de la semaine sont faites. Bravo !" },
  { title: "Performance exceptionnelle ! 🌟", message: "Tu as tout donné cette semaine. Impressionnant !" },
  { title: "Mission accomplie ! 🚀", message: "Semaine complète ! Tu es sur la voie de la réussite !" },
  { title: "Excellent travail ! 🔥", message: "Toutes tes séances terminées. Tu assures vraiment !" },
  { title: "Félicitations ! 🎉", message: "Semaine 100% validée. Tes efforts paient !" },
  { title: "Incroyable ! ⭐", message: "Tu n'as rien lâché cette semaine. Respect !" },
  { title: "Tu gères ! 💯", message: "Programme complet ! Tu es une vraie machine !" },
  { title: "Bravo ! 👏", message: "Toutes les séances bouclées. Tu peux être fier(e) de toi !" },
];

interface WeeklyCelebration {
  title: string;
  message: string;
}

export function useWeeklyCompletionCelebration(
  weekId: string | null,
  sessions: any[],
  isSessionCompleted: (session: any) => boolean
) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebration, setCelebration] = useState<WeeklyCelebration | null>(null);

  const getCelebrationKey = useCallback((wId: string) => {
    return `${WEEKLY_CELEBRATION_KEY}_${wId}`;
  }, []);

  const getRandomCelebration = useCallback((): WeeklyCelebration => {
    const randomIndex = Math.floor(Math.random() * weeklyMessages.length);
    return weeklyMessages[randomIndex];
  }, []);

  useEffect(() => {
    if (!weekId || sessions.length === 0) {
      return;
    }

    // Check if all sessions are completed
    const allCompleted = sessions.every((session) => isSessionCompleted(session));
    
    if (!allCompleted) {
      return;
    }

    // Check if we already celebrated this week
    const celebrationKey = getCelebrationKey(weekId);
    const alreadyCelebrated = localStorage.getItem(celebrationKey);

    if (alreadyCelebrated) {
      return;
    }

    // Show celebration
    const selectedCelebration = getRandomCelebration();
    setCelebration(selectedCelebration);
    setShowCelebration(true);

    // Mark as celebrated
    localStorage.setItem(celebrationKey, "true");
  }, [weekId, sessions, isSessionCompleted, getCelebrationKey, getRandomCelebration]);

  const closeCelebration = useCallback(() => {
    setShowCelebration(false);
    setCelebration(null);
  }, []);

  return {
    showCelebration,
    celebration,
    closeCelebration,
  };
}
