import { normalizeText } from "@/lib/utils";

/**
 * Récupération des rendez-vous de coaching depuis Google Calendar (via le
 * webhook n8n) et mise en correspondance avec les athlètes de l'app.
 * Utilisé par le Dashboard mobile ("Prochains coachings") et par le bouton
 * flottant de note (QuickCoachNote → proposer la dernière personne faite).
 */

const N8N_CALENDAR_WEBHOOK =
  "https://n8n-i4coc8gkwgok0s4k0gsscsgw.168.231.84.252.sslip.io/webhook/64ef905d-e4d8-49be-b4f9-f008823baa66";

export interface AppointmentAthlete {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface CoachAppointment {
  eventId: string;
  athleteId: string;
  athleteName: string;
  eventTitle: string;
  startTime: string;
  endTime: string;
}

/**
 * Appelle le webhook calendrier et renvoie les RDV (bruts) sur la fenêtre
 * [timeMin, timeMax], mis en correspondance avec un athlète par email d'invité
 * puis, à défaut, par nom dans le titre/description de l'événement.
 */
export async function fetchCoachAppointments(
  athletes: AppointmentAthlete[],
  timeMin: Date,
  timeMax: Date
): Promise<CoachAppointment[]> {
  let events: any[] = [];
  try {
    const res = await fetch(N8N_CALENDAR_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) events = data;
    else if (data.events) events = data.events;
    else if (data.items) events = data.items;
  } catch (err) {
    console.error("Calendar fetch error:", err);
    return [];
  }

  // Index athlètes : email -> {id, nom} et liste normalisée par nom
  const emailToAthlete = new Map<string, { id: string; name: string }>();
  const nameToAthlete: { id: string; name: string; norm: string; first: string; last: string }[] = [];
  const firstCount: Record<string, number> = {};
  const lastCount: Record<string, number> = {};
  athletes.forEach((a) => {
    const fullName = `${a.first_name || ""} ${a.last_name || ""}`.trim();
    if (a.email) emailToAthlete.set(a.email.toLowerCase(), { id: a.id, name: fullName });
    const first = normalizeText(a.first_name);
    const last = normalizeText(a.last_name);
    if (first || last) {
      nameToAthlete.push({ id: a.id, name: fullName, norm: normalizeText(fullName), first, last });
      if (first) firstCount[first] = (firstCount[first] || 0) + 1;
      if (last) lastCount[last] = (lastCount[last] || 0) + 1;
    }
  });

  const matched: CoachAppointment[] = [];
  for (const event of events) {
    const attendees = event.attendees || [];
    const startStr =
      typeof event.start === "object" ? event.start?.dateTime || event.start?.date : event.start;
    const endStr =
      typeof event.end === "object" ? event.end?.dateTime || event.end?.date : event.end;

    if (startStr) {
      const eventStart = new Date(startStr);
      if (eventStart < timeMin || eventStart > timeMax) continue;
    }

    let hit: { id: string; name: string } | null = null;
    // 1) par email d'invité
    for (const att of attendees) {
      const m = emailToAthlete.get((att.email || "").toLowerCase());
      if (m) { hit = m; break; }
    }
    // 2) par nom complet dans le titre / description
    if (!hit) {
      const haystack = normalizeText(`${event.summary || event.title || ""} ${event.description || ""}`);
      if (haystack) {
        const found = nameToAthlete.find(
          (a) =>
            (a.norm && haystack.includes(a.norm)) ||
            (a.first && a.last && haystack.includes(`${a.first} ${a.last}`)) ||
            (a.last && a.first && haystack.includes(`${a.last} ${a.first}`))
        );
        if (found) hit = { id: found.id, name: found.name };

        // 3) à défaut, par prénom OU nom UNIQUE (mot entier), ex. titre « Jérôme »
        if (!hit) {
          const words = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean));
          const found2 = nameToAthlete.find(
            (a) =>
              (a.first && firstCount[a.first] === 1 && words.has(a.first)) ||
              (a.last && lastCount[a.last] === 1 && words.has(a.last))
          );
          if (found2) hit = { id: found2.id, name: found2.name };
        }
      }
    }

    if (hit) {
      matched.push({
        eventId: event.id,
        athleteId: hit.id,
        athleteName: hit.name,
        eventTitle: event.summary || event.title || "RDV",
        startTime: startStr || "",
        endTime: endStr || "",
      });
    }
  }

  matched.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return matched;
}

/**
 * Parmi des RDV, renvoie les `count` plus proches de `ref` (distance absolue),
 * puis triés chronologiquement pour l'affichage.
 */
export function nearestAppointments(
  appointments: CoachAppointment[],
  ref: Date,
  count = 3
): CoachAppointment[] {
  const refTs = ref.getTime();
  return [...appointments]
    .filter((a) => a.startTime)
    .sort(
      (a, b) =>
        Math.abs(new Date(a.startTime).getTime() - refTs) -
        Math.abs(new Date(b.startTime).getTime() - refTs)
    )
    .slice(0, count)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Renvoie le RDV dont le DÉBUT est le plus récemment passé par rapport à `ref`
 * (la personne qui vient de terminer). `null` si aucun RDV passé.
 */
export function lastStartedAppointment(
  appointments: CoachAppointment[],
  ref: Date
): CoachAppointment | null {
  const refTs = ref.getTime();
  const past = appointments
    .filter((a) => a.startTime && new Date(a.startTime).getTime() <= refTs)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  return past[0] || null;
}
