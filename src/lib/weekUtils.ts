import { getWeek, startOfWeek, endOfWeek, addWeeks, setWeek } from "date-fns";

/**
 * Calcule le numéro de semaine ISO basé sur le lundi comme premier jour de la semaine
 * @param date La date pour laquelle calculer le numéro de semaine
 * @returns Le numéro de semaine ISO
 */
export function getWeekNumber(date: Date): number {
  return getWeek(date, { weekStartsOn: 1 }); // 1 = lundi
}

/**
 * Retourne le lundi de la semaine actuelle
 * @param date La date de référence
 * @returns Le lundi de la semaine
 */
export function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

/**
 * Retourne le dimanche de la semaine actuelle
 * @param date La date de référence
 * @returns Le dimanche de la semaine
 */
export function getSundayOfWeek(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 1 });
}

/**
 * Génère une liste des prochaines semaines à partir du lundi de la semaine actuelle
 * @param count Nombre de semaines à générer
 * @returns Liste des semaines avec leur numéro, année et date
 */
export function getNextWeeks(count: number = 12) {
  const weeks = [];
  const today = new Date();
  const mondayOfCurrentWeek = getMondayOfWeek(today);

  for (let i = 0; i < count; i++) {
    const targetDate = addWeeks(mondayOfCurrentWeek, i);
    const weekNum = getWeekNumber(targetDate);
    const year = targetDate.getFullYear();
    weeks.push({ 
      week: weekNum, 
      year, 
      date: targetDate,
      monday: getMondayOfWeek(targetDate),
      sunday: getSundayOfWeek(targetDate)
    });
  }

  return weeks;
}

/**
 * Retourne une date approximative pour une semaine et une année données
 * @param weekNumber Le numéro de semaine ISO
 * @param year L'année
 * @returns Une date dans cette semaine
 */
export function getDateFromWeekNumber(weekNumber: number, year: number): Date {
  const januaryFirst = new Date(year, 0, 1);
  const date = setWeek(januaryFirst, weekNumber, { weekStartsOn: 1 });
  return date;
}

/**
 * Formate une plage de dates de semaine (lundi - dimanche)
 * @param date La date de référence
 * @returns String formaté "DD/MM - DD/MM"
 */
export function formatWeekRange(date: Date): string {
  const monday = getMondayOfWeek(date);
  const sunday = getSundayOfWeek(date);
  
  const formatDate = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };
  
  return `${formatDate(monday)} - ${formatDate(sunday)}`;
}

/**
 * Formate une plage de dates de semaine à partir d'un numéro de semaine et d'une année
 * @param weekNumber Le numéro de semaine ISO
 * @param year L'année
 * @returns String formaté "DD/MM - DD/MM"
 */
export function formatWeekRangeFromNumber(weekNumber: number, year: number): string {
  const date = getDateFromWeekNumber(weekNumber, year);
  return formatWeekRange(date);
}

