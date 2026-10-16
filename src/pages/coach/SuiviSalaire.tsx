import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format, startOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { ChevronDown } from "lucide-react";

interface MonthlyData {
  month: string;
  monthLabel: string;
  transfers: number;
  cash: number;
  rent: number;
  total: number;
}

interface PeriodAgg { cash: number; transfer: number; general: number; urssaf: number; rent: number; net: number; months: number; }
interface Periods { curYear: number; year: PeriodAgg; last12: PeriodAgg; all: PeriodAgg; }
const EMPTY_P: PeriodAgg = { cash: 0, transfer: 0, general: 0, urssaf: 0, rent: 0, net: 0, months: 0 };

export default function SuiviSalaire() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [periods, setPeriods] = useState<Periods>({ curYear: new Date().getFullYear(), year: EMPTY_P, last12: EMPTY_P, all: EMPTY_P });
  const [openCat, setOpenCat] = useState<string | null>("general");
  const [hoverCat, setHoverCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMonthlyData();
  }, []);

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Charger les 12 derniers mois
      const months: MonthlyData[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStr = format(startOfMonth(monthDate), "yyyy-MM-01");
        const monthLabel = format(monthDate, "MMM yy", { locale: fr });

        // Charger les entrées comptables pour ce mois
        const { data: entries } = await supabase
          .from("accounting_entries")
          .select("amount_cash, amount_transfer")
          .eq("coach_id", session.user.id)
          .eq("month", monthStr);

        let cash = entries?.reduce((sum, e) => sum + (parseFloat(e.amount_cash?.toString() || "0") || 0), 0) || 0;
        let transfers = entries?.reduce((sum, e) => sum + (parseFloat(e.amount_transfer?.toString() || "0") || 0), 0) || 0;

        // Appliquer le coefficient 0.76 aux virements (par défaut activé)
        transfers = transfers * 0.76;
        // Pas de coefficient pour les espèces (par défaut désactivé)

        // Loyer : valeur du mois si définie, sinon loyer global, sinon défaut 300 € (comme la Comptabilité)
        const rentKey = `rent_${format(monthDate, "yyyy-MM")}`;
        const savedRent = localStorage.getItem(rentKey) ?? localStorage.getItem("rent_global");
        const rent = savedRent !== null ? (parseFloat(savedRent) || 0) : 300;

        // Résultat du mois = revenus (virements pondérés + espèces) − loyer
        const total = transfers + cash - rent;

        months.push({
          month: monthStr,
          monthLabel,
          transfers,
          cash,
          rent,
          total
        });
      }

      setMonthlyData(months);

      // ── Agrégats tout l'historique + année en cours ──────────────────────
      const { data: allEntries } = await supabase
        .from("accounting_entries")
        .select("amount_cash, amount_transfer, month")
        .eq("coach_id", session.user.id);
      const num = (v: any) => parseFloat(v?.toString() || "0") || 0;
      const curYear = new Date().getFullYear();
      const start12 = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-01");
      // Agrège les entrées filtrées par période (virements pondérés ×0,76)
      // On ne compte jamais les mois FUTURS (ex. mois pré-saisis) : plafond au mois en cours.
      const curMonth = format(startOfMonth(new Date()), "yyyy-MM-01");
      // Loyer d'un mois "yyyy-MM-01" : valeur du mois, sinon loyer global, sinon 300 € (comme la Comptabilité)
      const rentFor = (m: string) => { const v = localStorage.getItem(`rent_${m.slice(0, 7)}`) ?? localStorage.getItem("rent_global"); return v !== null ? (parseFloat(v) || 0) : 300; };
      const mk = (pred: (m: string) => boolean): PeriodAgg => {
        // Regroupe par mois pour pouvoir ignorer les mois à 0 €
        const byMonth = new Map<string, { cash: number; raw: number }>();
        (allEntries || []).forEach((e: any) => {
          const m = e.month;
          if (typeof m === "string" && m <= curMonth && pred(m)) {
            const cur = byMonth.get(m) || { cash: 0, raw: 0 };
            cur.cash += num(e.amount_cash); cur.raw += num(e.amount_transfer); byMonth.set(m, cur);
          }
        });
        let cash = 0, raw = 0; const activeMonths: string[] = [];
        byMonth.forEach((v, m) => { cash += v.cash; raw += v.raw; if (v.cash + v.raw > 0) activeMonths.push(m); });
        const transfer = raw * 0.76;
        const general = cash + transfer;
        const rent = activeMonths.reduce((s, m) => s + rentFor(m), 0); // loyer seulement sur les mois actifs
        return { cash, transfer, general, urssaf: raw * 0.24, rent, net: general - rent, months: activeMonths.length };
      };
      setPeriods({
        curYear,
        year: mk((m) => m.startsWith(`${curYear}`)),
        last12: mk((m) => m >= start12),
        all: mk(() => true),
      });
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  // Composant personnalisé pour dessiner les chandelles
  const CandlestickBar = (props: any) => {
    const { x, y, width, height, transfers, cash } = props;
    
    // Si pas de données, ne rien afficher
    if (!transfers && !cash) return null;

    const total = transfers + cash;
    const barWidth = Math.min(width * 0.6, 40);
    const centerX = x + width / 2;

    // Calculer les hauteurs proportionnelles
    const transferHeight = (transfers / total) * height;
    const cashHeight = (cash / total) * height;

    return (
      <g>
        {/* Partie basse - Virements (jaune) */}
        {transfers > 0 && (
          <rect
            x={centerX - barWidth / 2}
            y={y + height - transferHeight}
            width={barWidth}
            height={transferHeight}
            fill="hsl(var(--warning))"
            stroke="hsl(var(--border))"
            strokeWidth={1}
            rx={2}
          />
        )}
        
        {/* Partie haute - Espèces (orange) */}
        {cash > 0 && (
          <rect
            x={centerX - barWidth / 2}
            y={y + height - transferHeight - cashHeight}
            width={barWidth}
            height={cashHeight}
            fill="hsl(var(--destructive))"
            stroke="hsl(var(--border))"
            strokeWidth={1}
            rx={2}
          />
        )}
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{data.monthLabel}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(var(--destructive))" }}></div>
              <span className="text-muted-foreground">Espèces:</span>
              <span className="font-semibold">{data.cash.toFixed(2)} €</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(var(--warning))" }}></div>
              <span className="text-muted-foreground">Virements (×0.76):</span>
              <span className="font-semibold">{data.transfers.toFixed(2)} €</span>
            </div>
            {data.rent > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-muted-foreground/40"></div>
                <span className="text-muted-foreground">Loyer:</span>
                <span className="font-semibold text-red-500">− {data.rent.toFixed(2)} €</span>
              </div>
            )}
            <div className="pt-2 border-t flex justify-between gap-4">
              <span className="text-muted-foreground">Résultat net:</span>
              <span className="font-bold">{data.total.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const totalRevenue = monthlyData.reduce((sum, m) => sum + m.total, 0);
  const averageMonthly = monthlyData.length > 0 ? totalRevenue / monthlyData.length : 0;
  const maxMonth = monthlyData.reduce((max, m) => m.total > max.total ? m : max, monthlyData[0] || { total: 0, monthLabel: "" });
  // Revenu (hors loyer) sur les 12 derniers mois
  const revenue12 = monthlyData.reduce((sum, m) => sum + m.transfers + m.cash, 0);
  const avg12Revenue = monthlyData.length > 0 ? revenue12 / monthlyData.length : 0;
  const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  // Arborescence : catégories × périodes
  const CATS: { key: string; label: string; emoji: string; color: string; pick: (p: PeriodAgg) => number; hint: string }[] = [
    { key: "general", label: "Total général", emoji: "📊", color: "#e8c466", pick: (p) => p.general, hint: "cash + virement" },
    { key: "net", label: "Résultat net", emoji: "✅", color: "#9c7bd6", pick: (p) => p.net, hint: "après URSSAF + loyer" },
    { key: "cash", label: "Cash", emoji: "💶", color: "#5fbf82", pick: (p) => p.cash, hint: "espèces reçues (brut)" },
    { key: "virement", label: "Virement", emoji: "🏦", color: "#5aa9e6", pick: (p) => p.transfer, hint: "net (×0,76)" },
    { key: "urssaf", label: "URSSAF provisionné", emoji: "🧾", color: "#e8974a", pick: (p) => p.urssaf, hint: "24 % des virements" },
  ];
  const PERIODS: { key: string; label: string; data: PeriodAgg }[] = [
    { key: "year", label: `Année ${periods.curYear}`, data: periods.year },
    { key: "last12", label: "12 derniers mois", data: periods.last12 },
    { key: "all", label: "Total historique", data: periods.all },
  ];
  // Catégorie affichée dans le graphique (survol prioritaire, sinon catégorie ouverte, sinon général)
  const chartKey = hoverCat || openCat || "general";
  const chartCat = CATS.find((c) => c.key === chartKey) || CATS[0];
  const chartData = monthlyData.map((m) => {
    const raw = m.transfers / 0.76; // montant brut du virement
    const value = chartKey === "general" ? m.cash + m.transfers
      : chartKey === "net" ? m.total
      : chartKey === "cash" ? m.cash
      : chartKey === "virement" ? m.transfers
      : chartKey === "urssaf" ? raw * 0.24
      : m.cash + m.transfers;
    return { monthLabel: m.monthLabel, value: Math.round(value * 100) / 100 };
  });

  return (
    <div className="container mx-auto p-2 md:p-4 space-y-4 md:space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Suivi du salaire</h1>

      {loading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : (
        <>
          {/* ── Arborescence compta (clique pour déplier) ── */}
          <div className="space-y-2.5">
            {CATS.map((cat) => {
              const open = openCat === cat.key;
              return (
                <div key={cat.key} onMouseEnter={() => setHoverCat(cat.key)} onMouseLeave={() => setHoverCat(null)}
                  className="rounded-2xl border overflow-hidden transition-all" style={{ borderColor: open ? `${cat.color}66` : undefined, background: open ? `${cat.color}0d` : undefined }}>
                  {/* En-tête cliquable */}
                  <button type="button" onClick={() => setOpenCat(open ? null : cat.key)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors">
                    <span className="h-10 w-10 rounded-xl grid place-items-center text-lg shrink-0" style={{ background: `${cat.color}22` }}>{cat.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[15px] leading-tight">{cat.label}</p>
                      <p className="text-[11px] text-muted-foreground">{cat.hint}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg md:text-xl font-black tabular-nums" style={{ color: cat.color }}>{eur(cat.pick(periods.year))}</p>
                      <p className="text-[10px] text-muted-foreground">année {periods.curYear}</p>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {/* Contenu déplié : 3 périodes */}
                  {open && (
                    <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1">
                      {PERIODS.map((per) => (
                        <div key={per.key} className="rounded-xl border bg-card/60 p-3" style={{ borderColor: `${cat.color}33` }}>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                            <span className="text-[11px] font-semibold text-muted-foreground">{per.label}</span>
                          </div>
                          <p className="text-xl font-black tabular-nums mt-1">{eur(cat.pick(per.data))}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {per.data.months} mois{per.data.months > 0 ? ` · ${eur(cat.pick(per.data) / per.data.months)}/mois` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>


          {/* Graphique dynamique : reflète la carte survolée (12 derniers mois) */}
          <Card style={{ borderColor: `${chartCat.color}44` }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span>{chartCat.emoji}</span> {chartCat.label}
                <span className="text-xs font-normal text-muted-foreground">· 12 derniers mois</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[280px] md:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="monthLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}€`} />
                    <Tooltip
                      formatter={(v: any) => [eur(Number(v)), chartCat.label]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={chartCat.color} isAnimationActive />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-2">Survole une carte ci-dessus pour changer le graphique</p>
            </CardContent>
          </Card>

          {/* Tableau détaillé */}
          <Card>
            <CardHeader>
              <CardTitle>Détail mensuel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {monthlyData.slice().reverse().map((month) => (
                  <div 
                    key={month.month} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-semibold capitalize">{format(new Date(month.month), "MMMM yyyy", { locale: fr })}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Espèces</p>
                        <p className="font-semibold" style={{ color: "hsl(var(--destructive))" }}>{month.cash.toFixed(2)} €</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Virements (×0.76)</p>
                        <p className="font-semibold" style={{ color: "hsl(var(--warning))" }}>{month.transfers.toFixed(2)} €</p>
                      </div>
                      {month.rent > 0 && (
                        <div className="text-right">
                          <p className="text-muted-foreground text-xs">Loyer</p>
                          <p className="font-semibold text-red-500">− {month.rent.toFixed(2)} €</p>
                        </div>
                      )}
                      <div className="text-right min-w-[100px]">
                        <p className="text-muted-foreground text-xs">Résultat net</p>
                        <p className="font-bold text-lg">{month.total.toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
