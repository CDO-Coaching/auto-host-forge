/**
 * InjuryLocationPicker
 * Sélecteur de localisation de blessure par zones corporelles cliquables.
 * Utilisé dans DailyFatigueDialog et EditFatigueDialog.
 */

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";

export const INJURY_ZONES: { category: string; zones: string[] }[] = [
  {
    category: "Pied & Cheville",
    zones: ["Pied (plantaire)", "Orteils", "Tendon d'Achille", "Cheville"],
  },
  {
    category: "Jambe",
    zones: ["Mollet", "Tibia (périostite)", "Péroné"],
  },
  {
    category: "Genou",
    zones: ["Genou (avant / rotule)", "Genou (interne)", "Genou (externe / bandelette IT)"],
  },
  {
    category: "Cuisse & Hanche",
    zones: ["Quadriceps", "Ischio-jambiers", "Adducteurs", "Hanche (flexeur)", "Hanche (abducteur)", "Fessier"],
  },
  {
    category: "Bassin & Dos",
    zones: ["Pubis / aine", "Bas du dos (lombaires)", "Dos (milieu / thoracique)"],
  },
  {
    category: "Haut du corps",
    zones: ["Abdominaux", "Pectoral", "Épaule", "Biceps", "Triceps", "Coude", "Avant-bras / poignet", "Trapèzes", "Nuque / cervicales"],
  },
];

interface InjuryLocationPickerProps {
  value: string;
  onChange: (location: string) => void;
}

export function InjuryLocationPicker({ value, onChange }: InjuryLocationPickerProps) {
  // Tente de retrouver la zone et le côté depuis une valeur existante
  const detectZoneAndSide = (val: string): { zone: string; side: "gauche" | "droite" | "" } => {
    for (const group of INJURY_ZONES) {
      for (const zone of group.zones) {
        if (val === zone) return { zone, side: "" };
        if (val === `${zone} gauche`) return { zone, side: "gauche" };
        if (val === `${zone} droite`) return { zone, side: "droite" };
      }
    }
    return { zone: val, side: "" };
  };

  const detected = detectZoneAndSide(value);
  const [selectedZone, setSelectedZone] = useState(detected.zone);
  const [selectedSide, setSelectedSide] = useState<"gauche" | "droite" | "">(detected.side);

  // Sync si la valeur change de l'extérieur (ex: chargement d'une entrée existante)
  useEffect(() => {
    const d = detectZoneAndSide(value);
    setSelectedZone(d.zone);
    setSelectedSide(d.side);
  }, [value]);

  const selectZone = (zone: string) => {
    const newZone = selectedZone === zone ? "" : zone;
    setSelectedZone(newZone);
    setSelectedSide("");
    onChange(newZone);
  };

  const selectSide = (side: "gauche" | "droite") => {
    const newSide = selectedSide === side ? "" : side;
    setSelectedSide(newSide);
    onChange(newSide ? `${selectedZone} ${newSide}` : selectedZone);
  };

  const clearSide = () => {
    setSelectedSide("");
    onChange(selectedZone);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs sm:text-base">
        Localisation <span className="text-muted-foreground">(optionnel)</span>
      </Label>

      {/* Zones corporelles groupées */}
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {INJURY_ZONES.map((group) => (
          <div key={group.category}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {group.category}
            </p>
            <div className="flex flex-wrap gap-1">
              {group.zones.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => selectZone(zone)}
                  className={`px-2 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-colors border ${
                    selectedZone === zone
                      ? "bg-destructive/20 text-destructive border-destructive/50"
                      : "bg-muted/40 text-muted-foreground border-muted hover:bg-muted"
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sélecteur côté gauche/droite */}
      {selectedZone && INJURY_ZONES.some((g) => g.zones.includes(selectedZone)) && (
        <div className="flex gap-2 pt-1 items-center">
          <p className="text-[10px] text-muted-foreground shrink-0">Côté :</p>
          {(["gauche", "droite"] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => selectSide(side)}
              className={`px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-colors border ${
                selectedSide === side
                  ? "bg-destructive/20 text-destructive border-destructive/50"
                  : "bg-muted/40 text-muted-foreground border-muted hover:bg-muted"
              }`}
            >
              {side.charAt(0).toUpperCase() + side.slice(1)}
            </button>
          ))}
          <button
            type="button"
            onClick={clearSide}
            className={`px-3 py-1 rounded-md text-[10px] sm:text-xs font-medium transition-colors border ${
              selectedSide === ""
                ? "bg-muted text-foreground border-foreground/30"
                : "bg-muted/40 text-muted-foreground border-muted hover:bg-muted"
            }`}
          >
            Les deux
          </button>
        </div>
      )}

      {/* Aperçu */}
      {value && (
        <p className="text-[10px] text-destructive font-medium">📍 {value}</p>
      )}
    </div>
  );
}
