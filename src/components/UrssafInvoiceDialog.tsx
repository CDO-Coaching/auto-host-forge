import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  generateMonthlyInvoicesZip,
  downloadBlob,
  type CoachIssuer,
  type PaymentMethod,
  type InvoiceClientLine,
  type InvoiceItem,
} from "@/lib/ursaffInvoiceGenerator";

interface AccountingEntryLite {
  id: string;
  client_id?: string;
  external_client_id?: string;
  client_name: string;
  client_address?: string;
  client_phone?: string;
  sessions_done: number;
  amount_cash: number;
  amount_transfer: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: AccountingEntryLite[];
  currentMonth: Date;
  coach: CoachIssuer;
}

interface RowState {
  selected: boolean;
  payment_method: PaymentMethod;
  hasSessions: boolean;      // inclure des séances ?
  sessions: string;          // nombre de séances
  sessionsAmount: string;    // montant € des séances
  hasProgrammation: boolean; // inclure une programmation ?
  programmationAmount: string; // montant € de la programmation
}

const rowTotal = (r?: RowState): number => {
  if (!r) return 0;
  const s = r.hasSessions ? (parseFloat((r.sessionsAmount || "").replace(",", ".")) || 0) : 0;
  const p = r.hasProgrammation ? (parseFloat((r.programmationAmount || "").replace(",", ".")) || 0) : 0;
  return s + p;
};

export function UrssafInvoiceDialog({ open, onOpenChange, entries, currentMonth, coach }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");

  // Initialise les lignes quand on ouvre la modale
  useEffect(() => {
    if (!open) return;
    setSearch("");
    const init: Record<string, RowState> = {};
    entries.forEach((e) => {
      const total = (e.amount_cash || 0) + (e.amount_transfer || 0);
      init[e.id] = {
        selected: false,
        payment_method: "virement",
        hasSessions: (e.sessions_done || 0) > 0 || total > 0,
        sessions: String(e.sessions_done || 0),
        sessionsAmount: total ? total.toFixed(2) : "",
        hasProgrammation: false,
        programmationAmount: "",
      };
    });
    setRows(init);
  }, [open, entries]);

  // Afficher tous les sportifs (pour permettre de cocher manuellement même sans montant pré-rempli)
  const billable = useMemo(() => entries, [entries]);
  const visibleBillable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return billable;
    return billable.filter((e) => e.client_name.toLowerCase().includes(q));
  }, [billable, search]);

  const selectedCount = Object.values(rows).filter((r) => r.selected).length;
  const selectedTotal = billable.reduce(
    (sum, e) => sum + (rows[e.id]?.selected ? rowTotal(rows[e.id]) : 0),
    0
  );

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: fr });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const missingCoachInfo: string[] = [];
  if (!coach.siret) missingCoachInfo.push("SIRET");
  if (!coach.address) missingCoachInfo.push("Adresse");

  const defaultRow = (e: AccountingEntryLite): RowState => {
    const total = (e.amount_cash || 0) + (e.amount_transfer || 0);
    return {
      selected: true,
      payment_method: "virement",
      hasSessions: (e.sessions_done || 0) > 0 || total > 0,
      sessions: String(e.sessions_done || 0),
      sessionsAmount: total ? total.toFixed(2) : "",
      hasProgrammation: false,
      programmationAmount: "",
    };
  };

  const toggleAll = (value: boolean) => {
    const next: Record<string, RowState> = {};
    billable.forEach((e) => {
      next[e.id] = { ...(rows[e.id] || defaultRow(e)), selected: value };
    });
    setRows(next);
  };

  const setAllPaymentMethod = (method: PaymentMethod) => {
    const next: Record<string, RowState> = {};
    billable.forEach((e) => {
      const current = rows[e.id] || defaultRow(e);
      next[e.id] = { ...current, payment_method: method };
    });
    setRows(next);
  };

  // Sélectionne / déselectionne uniquement les sportifs ayant payé > 0 € via ce mode
  const toggleByPaymentSource = (source: "cash" | "transfer", value: boolean) => {
    const next: Record<string, RowState> = { ...rows };
    billable.forEach((e) => {
      const amount = source === "cash" ? (e.amount_cash || 0) : (e.amount_transfer || 0);
      if (amount > 0) {
        const current = next[e.id] || {
          ...defaultRow(e),
          payment_method: source === "cash" ? "especes" as PaymentMethod : "virement" as PaymentMethod,
        };
        next[e.id] = {
          ...current,
          selected: value,
          // Aligner le mode de règlement de la facture sur la source utilisée
          payment_method: source === "cash" ? "especes" : "virement",
        };
      }
    });
    setRows(next);
  };

  const cashCount = billable.filter((e) => (e.amount_cash || 0) > 0).length;
  const transferCount = billable.filter((e) => (e.amount_transfer || 0) > 0).length;

  const handleGenerate = async () => {
    const selected: InvoiceClientLine[] = billable
      .filter((e) => rows[e.id]?.selected)
      .map((e) => {
        const r = rows[e.id];
        const sessionsAmt = parseFloat((r.sessionsAmount || "").replace(",", ".")) || 0;
        const progAmt = parseFloat((r.programmationAmount || "").replace(",", ".")) || 0;
        const sessCount = parseInt(r.sessions) || 0;
        const hasS = r.hasSessions && sessionsAmt > 0;
        const hasP = r.hasProgrammation && progAmt > 0;
        // Composition :
        //  - séances seules → "Coaching sportif", quantité = N (prix unitaire par séance)
        //  - programmation seule → "Programmation", quantité = 1
        //  - les deux → forfait unique, quantité = 1
        let items: InvoiceItem[] = [];
        if (hasS && hasP) {
          items = [{ description: `Forfait ${sessCount} séance${sessCount > 1 ? "s" : ""} + programmation`, quantity: 1, amount: sessionsAmt + progAmt }];
        } else if (hasS) {
          items = [{ description: "Coaching sportif", quantity: sessCount > 0 ? sessCount : 1, amount: sessionsAmt }];
        } else if (hasP) {
          items = [{ description: "Programmation", quantity: 1, amount: progAmt }];
        }
        return {
          entryId: e.id,
          client_id: e.client_id,
          external_client_id: e.external_client_id,
          client_name: e.client_name,
          client_address: e.client_address,
          client_phone: e.client_phone,
          sessions_count: r.hasSessions ? sessCount : 0,
          total_amount: rowTotal(r),
          payment_method: r.payment_method,
          items: items.length > 0 ? items : undefined,
        };
      });

    if (selected.length === 0) {
      toast.error("Sélectionnez au moins un client");
      return;
    }

    setGenerating(true);
    try {
      const blob = await generateMonthlyInvoicesZip({ coach, currentMonth, selectedClients: selected });
      const fileName = `Factures_${format(currentMonth, "yyyy-MM")}.zip`;
      downloadBlob(blob, fileName);
      toast.success(`${selected.length} facture(s) générée(s) et archivée(s)`);
      onOpenChange(false);
    } catch (err: any) {
      console.error("[UrssafInvoiceDialog] generation error", err);
      toast.error(err?.message || "Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col gap-3 overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Générer les factures URSSAF — {monthLabelCap}
          </DialogTitle>
          <DialogDescription>
            Cochez les sportifs à facturer et indiquez le mode de règlement.
            Chaque facture sera numérotée chronologiquement et archivée (obligation légale).
          </DialogDescription>
        </DialogHeader>

        {missingCoachInfo.length > 0 && (
          <Alert variant="destructive" className="flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Informations manquantes</AlertTitle>
            <AlertDescription>
              Pour des factures conformes URSSAF, complète dans ton profil : <strong>{missingCoachInfo.join(", ")}</strong>.
            </AlertDescription>
          </Alert>
        )}

        {billable.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Aucun sportif dans la comptabilité ce mois-ci.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 border-b pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedCount === billable.length}
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                  <span className="text-sm font-medium">
                    {selectedCount} / {billable.length} sélectionné(s)
                  </span>
                </div>
                <div className="text-sm font-semibold text-primary">
                  Total : {selectedTotal.toFixed(2)} €
                </div>
              </div>
              <Input
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
                placeholder="Rechercher un nom…"
                className="h-8 text-sm"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Espèces ({cashCount}) :</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={cashCount === 0}
                  onClick={() => toggleByPaymentSource("cash", true)}
                >
                  Tout cocher
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={cashCount === 0}
                  onClick={() => toggleByPaymentSource("cash", false)}
                >
                  Tout décocher
                </Button>
                <span className="mx-1 h-4 w-px bg-border" />
                <span className="text-xs text-muted-foreground">Virement ({transferCount}) :</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={transferCount === 0}
                  onClick={() => toggleByPaymentSource("transfer", true)}
                >
                  Tout cocher
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={transferCount === 0}
                  onClick={() => toggleByPaymentSource("transfer", false)}
                >
                  Tout décocher
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-3">
              <div className="space-y-2">
                {visibleBillable.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">Aucun nom ne correspond à « {search} ».</p>
                )}
                {visibleBillable.map((e) => {
                  const state = rows[e.id] || defaultRow(e);
                  const patch = (p: Partial<RowState>) =>
                    setRows((prev) => ({ ...prev, [e.id]: { ...(prev[e.id] || defaultRow(e)), ...p } }));
                  return (
                    <div
                      key={e.id}
                      className={`flex flex-col gap-2 p-3 rounded-lg border transition-colors ${
                        state.selected ? "bg-card border-primary/30" : "bg-muted/30 opacity-60"
                      }`}
                    >
                      {/* Ligne 1 : sélection client + mode de règlement */}
                      <div className="flex items-center gap-3">
                        <Checkbox checked={state.selected} onCheckedChange={(v) => patch({ selected: !!v })} />
                        <div className="font-medium truncate flex-1">{e.client_name}</div>
                        <div className="text-sm font-semibold tabular-nums">{rowTotal(state).toFixed(2)} €</div>
                        <Select value={state.payment_method} onValueChange={(v: PaymentMethod) => patch({ payment_method: v })} disabled={!state.selected}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="especes">Espèces</SelectItem>
                            <SelectItem value="virement">Virement</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {state.selected && (
                        <div className="flex flex-wrap items-end gap-3 pl-7">
                          {/* Séances */}
                          <div className="flex items-center gap-2">
                            <Checkbox id={`sess-${e.id}`} checked={state.hasSessions} onCheckedChange={(v) => patch({ hasSessions: !!v })} />
                            <label htmlFor={`sess-${e.id}`} className="text-xs">Séances</label>
                            <Input type="number" min="0" value={state.sessions} onChange={(ev) => patch({ sessions: ev.target.value })} disabled={!state.hasSessions} className="h-8 w-14 text-center text-sm" title="Nombre de séances" />
                            <Input type="number" min="0" step="0.01" value={state.sessionsAmount} onChange={(ev) => patch({ sessionsAmount: ev.target.value })} disabled={!state.hasSessions} placeholder="€" className="h-8 w-20 text-center text-sm" title="Montant des séances" />
                          </div>
                          {/* Programmation */}
                          <div className="flex items-center gap-2">
                            <Checkbox id={`prog-${e.id}`} checked={state.hasProgrammation} onCheckedChange={(v) => patch({ hasProgrammation: !!v })} />
                            <label htmlFor={`prog-${e.id}`} className="text-xs">Programmation</label>
                            <Input type="number" min="0" step="0.01" value={state.programmationAmount} onChange={(ev) => patch({ programmationAmount: ev.target.value })} disabled={!state.hasProgrammation} placeholder="€" className="h-8 w-20 text-center text-sm" title="Montant de la programmation" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Annuler
          </Button>
          <Button onClick={handleGenerate} disabled={generating || selectedCount === 0}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Générer le ZIP ({selectedCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
