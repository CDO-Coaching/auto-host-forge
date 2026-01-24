import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface InvoiceEntry {
  id: string;
  client_name: string;
  sessions_planned: number;
  sessions_done: number;
  sessions_paid: number;
  payment_type: string;
  amount_cash: number;
  amount_transfer: number;
}

export interface CoachInfo {
  first_name: string;
  last_name: string;
  email?: string;
}

/**
 * Génère un PDF avec toutes les factures du mois
 */
export const exportMonthlyInvoicesToPdf = (
  entries: InvoiceEntry[],
  currentMonth: Date,
  coachInfo: CoachInfo
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  
  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: fr });
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  
  // Filtrer uniquement les entrées avec des paiements
  const paidEntries = entries.filter(e => e.amount_cash > 0 || e.amount_transfer > 0);
  
  if (paidEntries.length === 0) {
    // Si aucune facture, créer un PDF avec un message
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Factures - " + monthLabelCapitalized, pageWidth / 2, 30, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Aucune facture à générer pour ce mois.", pageWidth / 2, 60, { align: "center" });
    
    doc.save(`factures_${format(currentMonth, "yyyy-MM")}.pdf`);
    return;
  }

  let invoiceNumber = 1;
  
  paidEntries.forEach((entry, index) => {
    if (index > 0) {
      doc.addPage();
    }
    
    let y = margin;
    
    // En-tête de facture
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("FACTURE", pageWidth / 2, y, { align: "center" });
    y += 15;
    
    // Numéro de facture et date
    const invoiceRef = `${format(currentMonth, "yyyyMM")}-${String(invoiceNumber).padStart(3, "0")}`;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`N° ${invoiceRef}`, pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.text(`Date: ${format(new Date(), "dd/MM/yyyy")}`, pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 15;
    
    // Ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;
    
    // Informations Coach (émetteur)
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Émetteur:", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`${coachInfo.first_name} ${coachInfo.last_name}`, margin, y);
    y += 5;
    if (coachInfo.email) {
      doc.text(coachInfo.email, margin, y);
      y += 5;
    }
    doc.text("Coach sportif", margin, y);
    y += 15;
    
    // Informations Client (destinataire)
    doc.setFont("helvetica", "bold");
    doc.text("Client:", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(entry.client_name, margin, y);
    y += 20;
    
    // Période de facturation
    doc.setFont("helvetica", "bold");
    doc.text("Période:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(monthLabelCapitalized, margin + 25, y);
    y += 15;
    
    // Ligne de séparation
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
    
    // Tableau des prestations
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Détail des prestations", margin, y);
    y += 10;
    
    // En-tête du tableau
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 5, contentWidth, 10, "F");
    doc.setFontSize(10);
    doc.text("Description", margin + 5, y);
    doc.text("Quantité", margin + 90, y);
    doc.text("Mode", margin + 120, y);
    doc.text("Montant", pageWidth - margin - 5, y, { align: "right" });
    y += 10;
    
    // Ligne du tableau
    doc.setFont("helvetica", "normal");
    doc.text("Séances de coaching sportif", margin + 5, y);
    doc.text(`${entry.sessions_paid}`, margin + 95, y);
    
    // Mode de paiement
    let paymentMode = "";
    if (entry.amount_cash > 0 && entry.amount_transfer > 0) {
      paymentMode = "Mixte";
    } else if (entry.amount_cash > 0) {
      paymentMode = "Espèces";
    } else {
      paymentMode = "Virement";
    }
    doc.text(paymentMode, margin + 120, y);
    
    const totalAmount = entry.amount_cash + entry.amount_transfer;
    doc.text(`${totalAmount.toFixed(2)} €`, pageWidth - margin - 5, y, { align: "right" });
    y += 15;
    
    // Détail si paiement mixte
    if (entry.amount_cash > 0 && entry.amount_transfer > 0) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`   • Espèces: ${entry.amount_cash.toFixed(2)} €`, margin + 5, y);
      y += 5;
      doc.text(`   • Virement: ${entry.amount_transfer.toFixed(2)} €`, margin + 5, y);
      doc.setTextColor(0, 0, 0);
      y += 15;
    }
    
    // Ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
    
    // Total
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", margin, y);
    doc.text(`${totalAmount.toFixed(2)} €`, pageWidth - margin, y, { align: "right" });
    y += 20;
    
    // Mention TVA
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("TVA non applicable, article 293 B du CGI", margin, y);
    y += 15;
    
    // Pied de page
    doc.setFontSize(8);
    doc.text(
      `Facture générée le ${format(new Date(), "dd/MM/yyyy à HH:mm")}`,
      pageWidth / 2,
      pageHeight - 15,
      { align: "center" }
    );
    
    invoiceNumber++;
  });
  
  // Sauvegarder le PDF
  doc.save(`factures_${format(currentMonth, "yyyy-MM")}.pdf`);
};

/**
 * Génère un récapitulatif mensuel en PDF
 */
export const exportMonthlySummaryToPdf = (
  entries: InvoiceEntry[],
  currentMonth: Date,
  coachInfo: CoachInfo,
  totals: {
    cash: number;
    transfer: number;
    total: number;
    sessionsPlanned: number;
    sessionsDone: number;
    sessionsPaid: number;
  }
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  
  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: fr });
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  
  let y = margin;
  
  // Titre
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Récapitulatif Mensuel", pageWidth / 2, y, { align: "center" });
  y += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(monthLabelCapitalized, pageWidth / 2, y, { align: "center" });
  y += 15;
  
  // Infos coach
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`${coachInfo.first_name} ${coachInfo.last_name}`, pageWidth / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 20;
  
  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;
  
  // Résumé des totaux
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Résumé financier", margin, y);
  y += 12;
  
  doc.setFont("helvetica", "normal");
  const summaryData = [
    ["Total Espèces", `${totals.cash.toFixed(2)} €`],
    ["Total Virements", `${totals.transfer.toFixed(2)} €`],
    ["Total Général", `${totals.total.toFixed(2)} €`],
    ["", ""],
    ["Séances prévues", `${totals.sessionsPlanned}`],
    ["Séances réalisées", `${totals.sessionsDone}`],
    ["Séances payées", `${totals.sessionsPaid}`],
  ];
  
  summaryData.forEach(([label, value]) => {
    if (label) {
      doc.text(label, margin + 10, y);
      doc.text(value, pageWidth - margin - 10, y, { align: "right" });
    }
    y += 7;
  });
  
  y += 10;
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;
  
  // Détail par client
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Détail par client", margin, y);
  y += 12;
  
  // En-tête tableau
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 5, contentWidth, 10, "F");
  doc.setFontSize(9);
  doc.text("Client", margin + 5, y);
  doc.text("Prév.", margin + 75, y);
  doc.text("Réal.", margin + 95, y);
  doc.text("Payé", margin + 115, y);
  doc.text("Esp. €", margin + 135, y);
  doc.text("Vir. €", margin + 155, y);
  doc.text("Total €", pageWidth - margin - 5, y, { align: "right" });
  y += 10;
  
  doc.setFont("helvetica", "normal");
  entries.forEach(entry => {
    // Vérifier si on a besoin d'une nouvelle page
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    
    const total = entry.amount_cash + entry.amount_transfer;
    
    // Tronquer le nom si trop long
    let clientName = entry.client_name;
    if (clientName.length > 25) {
      clientName = clientName.substring(0, 22) + "...";
    }
    
    doc.text(clientName, margin + 5, y);
    doc.text(`${entry.sessions_planned}`, margin + 78, y);
    doc.text(`${entry.sessions_done}`, margin + 98, y);
    doc.text(`${entry.sessions_paid}`, margin + 118, y);
    doc.text(`${entry.amount_cash.toFixed(0)}`, margin + 138, y);
    doc.text(`${entry.amount_transfer.toFixed(0)}`, margin + 158, y);
    doc.text(`${total.toFixed(2)}`, pageWidth - margin - 5, y, { align: "right" });
    y += 6;
  });
  
  // Pied de page
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.text(
    `Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}`,
    pageWidth / 2,
    pageHeight - 15,
    { align: "center" }
  );
  
  doc.save(`recapitulatif_${format(currentMonth, "yyyy-MM")}.pdf`);
};
