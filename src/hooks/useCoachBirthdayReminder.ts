import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BirthdayAthlete {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
}

export function useCoachBirthdayReminder(coachId: string | undefined) {
  const [birthdayAthletes, setBirthdayAthletes] = useState<BirthdayAthlete[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!coachId) return;

    const checkBirthdays = async () => {
      // Récupérer la date du jour (mois et jour uniquement)
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();

      // Récupérer les athlètes approuvés du coach
      const { data: relationships, error: relError } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", coachId)
        .eq("status", "approved");

      if (relError || !relationships?.length) return;

      const athleteIds = relationships.map((r) => r.athlete_id);

      // Récupérer les profils des athlètes avec leur date de naissance
      const { data: athletes, error: athletesError } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, date_of_birth")
        .in("id", athleteIds)
        .not("date_of_birth", "is", null);

      if (athletesError || !athletes?.length) return;

      // Filtrer les athlètes dont c'est l'anniversaire aujourd'hui
      const birthdayToday = athletes.filter((athlete) => {
        if (!athlete.date_of_birth) return false;
        const dob = new Date(athlete.date_of_birth);
        return dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay;
      });

      // Calculer l'âge et formater les données
      const formattedBirthdays: BirthdayAthlete[] = birthdayToday.map((athlete) => {
        const dob = new Date(athlete.date_of_birth!);
        const age = today.getFullYear() - dob.getFullYear();
        return {
          id: athlete.id,
          first_name: athlete.first_name || "",
          last_name: athlete.last_name || "",
          age,
        };
      });

      // Vérifier les rappels déjà dismissés aujourd'hui
      const todayKey = `${today.getFullYear()}-${todayMonth}-${todayDay}`;
      const dismissedKey = `birthday_dismissed_${coachId}_${todayKey}`;
      const dismissed = localStorage.getItem(dismissedKey);
      const dismissedList = dismissed ? JSON.parse(dismissed) : [];
      setDismissedIds(dismissedList);

      // Filtrer les athlètes non dismissés
      const filteredBirthdays = formattedBirthdays.filter(
        (a) => !dismissedList.includes(a.id)
      );

      setBirthdayAthletes(filteredBirthdays);
    };

    checkBirthdays();
  }, [coachId]);

  const dismissBirthday = (athleteId: string) => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const dismissedKey = `birthday_dismissed_${coachId}_${todayKey}`;
    
    const newDismissed = [...dismissedIds, athleteId];
    localStorage.setItem(dismissedKey, JSON.stringify(newDismissed));
    setDismissedIds(newDismissed);
    setBirthdayAthletes((prev) => prev.filter((a) => a.id !== athleteId));
  };

  return { birthdayAthletes, dismissBirthday };
}
