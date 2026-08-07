import bodyImg from "@/assets/muscles-body.png";

export interface MuscleSelection {
  principal: string | null;
  secondary: string[];
}

// Coordonnées dans l'espace de l'image (viewBox 2000 x 1657).
// bx,by = point du muscle ; lx,ly = ancrage du label ; a = alignement du texte.
interface Marker { m: string; label: string; bx: number; by: number; lx: number; ly: number; a: "start" | "end" }

const MARKERS: Marker[] = [
  // ── FACE (corps de gauche) ──
  { m: "DELTOÏDES", label: "Deltoïdes", bx: 258, by: 430, lx: 150, ly: 430, a: "end" },
  { m: "BICEPS", label: "Biceps", bx: 236, by: 545, lx: 150, ly: 555, a: "end" },
  { m: "AVANT-BRAS", label: "Avant-bras", bx: 208, by: 690, lx: 150, ly: 690, a: "end" },
  { m: "OBLIQUES", label: "Obliques", bx: 300, by: 655, lx: 150, ly: 830, a: "end" },
  { m: "QUADRICEPS", label: "Quadriceps", bx: 322, by: 910, lx: 150, ly: 965, a: "end" },
  { m: "MOLLETS", label: "Mollets", bx: 330, by: 1155, lx: 150, ly: 1155, a: "end" },
  { m: "PEC", label: "Pectoraux", bx: 366, by: 500, lx: 600, ly: 470, a: "start" },
  { m: "ABDOS", label: "Abdos", bx: 366, by: 620, lx: 600, ly: 615, a: "start" },
  { m: "FLÉCHISSEURS DE HANCHES", label: "Fléch. hanches", bx: 336, by: 750, lx: 600, ly: 760, a: "start" },
  { m: "ADDUCTEURS", label: "Adducteurs", bx: 366, by: 860, lx: 600, ly: 905, a: "start" },
  // ── DOS (corps de droite) ──
  { m: "TRICEPS", label: "Triceps", bx: 1152, by: 560, lx: 1120, ly: 560, a: "end" },
  { m: "LOMBAIRES", label: "Lombaires", bx: 1292, by: 690, lx: 1120, ly: 700, a: "end" },
  { m: "PETITS ET MOYENS FESSIERS", label: "Petits/moy. fess.", bx: 1226, by: 770, lx: 1120, ly: 815, a: "end" },
  { m: "ISCHIOS", label: "Ischios", bx: 1252, by: 955, lx: 1120, ly: 960, a: "end" },
  { m: "TRAPÈZES", label: "Trapèzes", bx: 1292, by: 410, lx: 1850, ly: 405, a: "start" },
  { m: "DELTOÏDES", label: "Deltoïdes", bx: 1412, by: 448, lx: 1850, ly: 520, a: "start" },
  { m: "DOS", label: "Dos", bx: 1336, by: 565, lx: 1850, ly: 640, a: "start" },
  { m: "FESSIERS", label: "Fessiers", bx: 1316, by: 800, lx: 1850, ly: 810, a: "start" },
  { m: "MOLLETS", label: "Mollets", bx: 1336, by: 1155, lx: 1850, ly: 1155, a: "start" },
];

function BodySvg({ viewBox, markers, stateOf, toggle, hideOff }: { viewBox: string; markers: Marker[]; stateOf: (m: string) => "principal" | "secondary" | "off"; toggle: (m: string) => void; hideOff?: boolean }) {
  return (
    <svg viewBox={viewBox} className="w-full h-auto select-none" preserveAspectRatio="xMidYMid meet">
      <image href={bodyImg} x="0" y="0" width="2000" height="1657" />
      {markers.map((mk) => {
        const st = stateOf(mk.m);
        if (st === "off") return null;
        return (
          <circle key={"halo" + mk.m + mk.lx} cx={mk.bx} cy={mk.by} r={70}
            fill="hsl(var(--primary))" opacity={st === "principal" ? 0.32 : 0.16} />
        );
      })}
      {markers.map((mk) => {
        const st = stateOf(mk.m);
        if (hideOff && st === "off") return null;
        const col = st === "principal" ? "hsl(var(--primary))" : st === "secondary" ? "#f2d98a" : "#ffffff";
        const lineStartX = mk.a === "end" ? mk.lx + 14 : mk.lx - 14;
        return (
          <g key={mk.m + mk.lx} onClick={() => toggle(mk.m)} className="cursor-pointer">
            <rect x={mk.a === "end" ? mk.lx - 340 : mk.lx - 10} y={mk.ly - 26} width="360" height="52" fill="transparent" />
            <line x1={lineStartX} y1={mk.ly} x2={mk.bx} y2={mk.by} stroke={col} strokeWidth={st === "principal" ? 5 : 3} />
            <circle cx={mk.bx} cy={mk.by} r={st === "principal" ? 16 : 12} fill={col} />
            <text x={mk.lx} y={mk.ly + 16} textAnchor={mk.a} fontSize="48"
              fontFamily="ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif"
              fill={col} fontWeight={700}
              style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 6 } as any}>
              {mk.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Sélecteur de muscles sur une planche anatomique (face + dos).
 * 1er clic = principal (doré), suivants = secondaires. Re-cliquer désélectionne.
 * Desktop : face + dos côte à côte. Mobile : empilés (plus grand).
 */
export function MuscleBodySelector({ value, onChange }: { value: MuscleSelection; onChange: (s: MuscleSelection) => void }) {
  const toggle = (m: string) => {
    let { principal, secondary } = value;
    if (principal === m) principal = null;
    else if (secondary.includes(m)) secondary = secondary.filter((x) => x !== m);
    else if (!principal) principal = m;
    else secondary = [...secondary, m];
    onChange({ principal, secondary });
  };

  const stateOf = (m: string): "principal" | "secondary" | "off" =>
    value.principal === m ? "principal" : value.secondary.includes(m) ? "secondary" : "off";
  const frontMarkers = MARKERS.filter((mk) => mk.bx < 1000);
  const backMarkers = MARKERS.filter((mk) => mk.bx >= 1000);

  return (
    <div className="space-y-2">
      {/* Desktop : les deux côte à côte */}
      <div className="hidden sm:block">
        <BodySvg viewBox="-320 120 2640 1360" markers={MARKERS} stateOf={stateOf} toggle={toggle} />
      </div>
      {/* Mobile : empilés, chacun en grand */}
      <div className="sm:hidden space-y-4">
        <div>
          <p className="text-center text-xs font-semibold text-muted-foreground mb-1">Face</p>
          <BodySvg viewBox="-360 120 1360 1360" markers={frontMarkers} stateOf={stateOf} toggle={toggle} />
        </div>
        <div>
          <p className="text-center text-xs font-semibold text-muted-foreground mb-1">Dos</p>
          <BodySvg viewBox="780 120 1580 1360" markers={backMarkers} stateOf={stateOf} toggle={toggle} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        1er muscle touché = <span className="text-primary font-medium">principal</span>, les suivants = secondaires. Re-toucher pour retirer.
      </p>
    </div>
  );
}

/**
 * Version LECTURE SEULE : affiche les muscles recrutés par un exercice.
 * principal = doré, secondaires = doré clair. Non cliquable.
 */
export function MuscleBodyView({ principal, secondary }: { principal: string | null; secondary: string[] }) {
  const stateOf = (m: string): "principal" | "secondary" | "off" =>
    principal === m ? "principal" : secondary.includes(m) ? "secondary" : "off";
  const noop = () => {};
  const frontMarkers = MARKERS.filter((mk) => mk.bx < 1000);
  const backMarkers = MARKERS.filter((mk) => mk.bx >= 1000);
  return (
    <div className="space-y-3">
      <div className="hidden sm:block">
        <BodySvg viewBox="-320 120 2640 1360" markers={MARKERS} stateOf={stateOf} toggle={noop} hideOff />
      </div>
      <div className="sm:hidden space-y-4">
        <div>
          <p className="text-center text-xs font-semibold text-muted-foreground mb-1">Face</p>
          <BodySvg viewBox="-360 120 1360 1360" markers={frontMarkers} stateOf={stateOf} toggle={noop} hideOff />
        </div>
        <div>
          <p className="text-center text-xs font-semibold text-muted-foreground mb-1">Dos</p>
          <BodySvg viewBox="780 120 1580 1360" markers={backMarkers} stateOf={stateOf} toggle={noop} hideOff />
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(var(--primary))" }} /> Principal</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#f2d98a" }} /> Secondaire</span>
      </div>
    </div>
  );
}

/**
 * Version FILTRE de la silhouette : multi-sélection simple (pas de principal/secondaire).
 * Un muscle sélectionné s'affiche en doré ; re-toucher le retire.
 */
export function MuscleBodyFilter({ selected, onToggle }: { selected: string[]; onToggle: (m: string) => void }) {
  const stateOf = (m: string): "principal" | "secondary" | "off" => (selected.includes(m) ? "principal" : "off");
  const frontMarkers = MARKERS.filter((mk) => mk.bx < 1000);
  const backMarkers = MARKERS.filter((mk) => mk.bx >= 1000);
  return (
    <div className="space-y-2">
      <div className="hidden sm:block">
        <BodySvg viewBox="-320 120 2640 1360" markers={MARKERS} stateOf={stateOf} toggle={onToggle} />
      </div>
      <div className="sm:hidden space-y-4">
        <div>
          <p className="text-center text-xs font-semibold text-muted-foreground mb-1">Face</p>
          <BodySvg viewBox="-360 120 1360 1360" markers={frontMarkers} stateOf={stateOf} toggle={onToggle} />
        </div>
        <div>
          <p className="text-center text-xs font-semibold text-muted-foreground mb-1">Dos</p>
          <BodySvg viewBox="780 120 1580 1360" markers={backMarkers} stateOf={stateOf} toggle={onToggle} />
        </div>
      </div>
    </div>
  );
}
