import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FileText, Loader2, RefreshCw, Download, Calendar, CheckCircle } from "lucide-react";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Invoice {
  id: string;
  invoice_number: string;
  product_name: string;
  amount: number;
  currency: string;
  paid_at: string;
  status: string;
  email_sent: boolean;
}

export default function MesFactures() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadInvoices();
    }
  }, [user]);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("athlete_invoices")
        .select("*")
        .eq("athlete_id", user?.id)
        .order("paid_at", { ascending: false });

      if (error) {
        if ((error as any)?.code === "42P01") {
          console.log("Table athlete_invoices non créée");
          return;
        }
        throw error;
      }

      setInvoices(data || []);
    } catch (error) {
      console.error("Erreur chargement factures:", error);
      toast.error("Erreur lors du chargement des factures");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
    toast.success("Factures actualisées");
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const downloadInvoicePdf = async (invoice: Invoice) => {
    try {
      // Récupérer les infos du profil pour l'adresse
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("first_name, last_name, email, address")
        .eq("id", user?.id)
        .single();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;

      let y = margin;

      // En-tête
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("FACTURE", pageWidth / 2, y, { align: "center" });
      y += 15;

      // Numéro et date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`N° ${invoice.invoice_number}`, pageWidth / 2, y, { align: "center" });
      y += 6;
      doc.text(`Date : ${format(new Date(invoice.paid_at), "dd/MM/yyyy")}`, pageWidth / 2, y, { align: "center" });
      doc.setTextColor(0, 0, 0);
      y += 15;

      // Ligne de séparation
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      // Émetteur (Coach)
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Émetteur :", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.text("CDO Coaching", margin, y);
      y += 5;
      doc.text("Coach sportif", margin, y);
      y += 15;

      // Client
      doc.setFont("helvetica", "bold");
      doc.text("Client :", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      const clientName = profile
        ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
        : "Client";
      doc.text(clientName, margin, y);
      y += 5;
      if (profile?.email) {
        doc.text(profile.email, margin, y);
        y += 5;
      }
      if (profile?.address) {
        const addressLines = doc.splitTextToSize(profile.address, 80);
        addressLines.forEach((line: string) => {
          doc.text(line, margin, y);
          y += 5;
        });
      }
      y += 10;

      // Ligne de séparation
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Tableau des prestations
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Détail de la prestation", margin, y);
      y += 10;

      // En-tête du tableau
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 5, pageWidth - margin * 2, 10, "F");
      doc.setFontSize(10);
      doc.text("Description", margin + 5, y);
      doc.text("Montant", pageWidth - margin - 5, y, { align: "right" });
      y += 10;

      // Ligne du tableau
      doc.setFont("helvetica", "normal");
      doc.text(invoice.product_name, margin + 5, y);
      doc.text(formatPrice(invoice.amount, invoice.currency), pageWidth - margin - 5, y, { align: "right" });
      y += 15;

      // Ligne de séparation
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Total
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL", margin, y);
      doc.text(formatPrice(invoice.amount, invoice.currency), pageWidth - margin, y, { align: "right" });
      y += 20;

      // Mention TVA
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("TVA non applicable, article 293 B du CGI", margin, y);
      y += 10;

      // Statut payé
      doc.setFontSize(10);
      doc.setTextColor(34, 197, 94);
      doc.text("✓ PAYÉE", margin, y);
      doc.setTextColor(0, 0, 0);

      // Pied de page
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Facture générée le ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}`,
        pageWidth / 2,
        pageHeight - 15,
        { align: "center" }
      );

      // Sauvegarder
      doc.save(`facture_${invoice.invoice_number}.pdf`);
      toast.success("Facture téléchargée");
    } catch (error) {
      console.error("Erreur génération PDF:", error);
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Mes factures
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Historique de vos factures
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Aucune facture</h2>
            <p className="text-muted-foreground text-center">
              Vos factures apparaîtront ici après vos paiements.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique des factures</CardTitle>
            <CardDescription>
              {invoices.length} facture{invoices.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-muted-foreground">
                        {invoice.invoice_number}
                      </span>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Payée
                      </Badge>
                    </div>
                    <p className="font-semibold mt-1">{invoice.product_name}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(invoice.paid_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary">
                      {formatPrice(invoice.amount, invoice.currency)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadInvoicePdf(invoice)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
