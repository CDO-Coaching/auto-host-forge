import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/lib/ursaffInvoiceGenerator";

interface AccountingEntryLite {
  id: string;
  client_id?: string;
  external_client_id?: string;
  client_name: string;
  client_address?: string;
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
}

export function UrssafInvoiceDialog({ open, onOpenChange, entries, currentMonth, coach }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [generating, setGenerating] = useState(false);

  // Initialise les lignes quand on ouvre la modale
  useEffect(() => {
    if (!open) return;
    const init: Record<string, RowState> = {};
    entries.forEach((e) => {
      const total = (e.amount_cash || 0) + (e.amount_transfer || 0);
      // Pré-sélectionner uniquement les sportifs avec un montant encaissé
      const dominant: PaymentMethod = (e.amount_cash || 0) >= (e.amount_transfer || 0) ? "especes" : "virement";
      init[e.id] = { selected: total > 0, payment_method: dominant };
    });
    setRows(init);
  }, [open, entries]);

  // Afficher tous les sportifs (pour permettre de cocher manuellement même sans montant pré-rempli)
  const billable = useMemo(() => entries, [entries]);

  const selectedCount = Object.values(rows).filter((r) => r.selected).length;
  const selectedTotal = billable.reduce(
    (sum, e) => sum + (rows[e.id]?.selected ? (e.amount_cash || 0) + (e.amount_transfer || 0) : 0),
    0
  );

  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: fr });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const missingCoachInfo: string[] = [];
  if (!coach.siret) missingCoachInfo.push("SIRET");
  if (!coach.address) missingCoachInfo.push("Adresse");

  const toggleAll = (value: boolean) => {
    const next: Record<string, RowState> = {};
    billable.forEach((e) => {
      next[e.id] = { ...(rows[e.id] || { payment_method: "virement" }), selected: value };
    });
    setRows(next);
  };

  const handleGenerate = async () => {
    const selected: InvoiceClientLine[] = billable
      .filter((e) => rows[e.id]?.selected)
      .map((e) => ({
        entryId: e.id,
        client_id: e.client_id,
        external_client_id: e.external_client_id,
        client_name: e.client_name,
        client_address: e.client_address,
        sessions_count: e.sessions_done || 0,
        total_amount: (e.amount_cash || 0) + (e.amount_transfer || 0),
        payment_method: rows[e.id].payment_method,
      }));

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
            Aucun client à facturer ce mois-ci (aucun montant encaissé).
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b pb-2 flex-shrink-0">
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

            <div className="flex-1 min-h-0 overflow-y-auto pr-3">
              <div className="space-y-2">
                {billable.map((e) => {
                  const total = (e.amount_cash || 0) + (e.amount_transfer || 0);
                  const state = rows[e.id] || { selected: true, payment_method: "virement" as PaymentMethod };
                  return (
                    <div
                      key={e.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        state.selected ? "bg-card border-primary/30" : "bg-muted/30 opacity-60"
                      }`}
                    >
                      <Checkbox
                        checked={state.selected}
                        onCheckedChange={(v) =>
                          setRows((prev) => ({ ...prev, [e.id]: { ...state, selected: !!v } }))
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{e.client_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.sessions_done || 0} séance(s) · {total.toFixed(2)} €
                        </div>
                      </div>
                      <Select
                        value={state.payment_method}
                        onValueChange={(v: PaymentMethod) =>
                          setRows((prev) => ({ ...prev, [e.id]: { ...state, payment_method: v } }))
                        }
                        disabled={!state.selected}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="especes">Espèces</SelectItem>
                          <SelectItem value="virement">Virement</SelectItem>
                        </SelectContent>
                      </Select>
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
