import { Activity, HeartPulse, TrendingUp, Scale, Wind } from "lucide-react";
import { HubGrid, HubTile } from "@/components/HubGrid";

const tiles: HubTile[] = [
  { title: "Suivi fatigue", description: "Ton état de forme au quotidien", url: "/sportif/fatigue", icon: Activity },
  { title: "Données physio", description: "FC, VMA, zones…", url: "/sportif/physiologie", icon: HeartPulse },
  { title: "Mes max", description: "Records et charges max", url: "/sportif/maxes", icon: TrendingUp },
  { title: "Mon poids", description: "Évolution du poids", url: "/sportif/poids", icon: Scale },
  { title: "Méditation", description: "Respiration & récupération", url: "/sportif/meditation", icon: Wind },
];

export default function MonSuivi() {
  return <HubGrid title="Mon suivi" tiles={tiles} />;
}
