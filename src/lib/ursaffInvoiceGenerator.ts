import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import { format, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { embedFacturXIntoPdf, type FacturXInvoiceData } from "@/lib/facturXBuilder";

export type PaymentMethod = "especes" | "virement";

export interface CoachIssuer {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  address?: string | null;
  siret?: string | null;
  phone?: string | null;
}

export interface InvoiceClientLine {
  entryId: string;
  client_id?: string | null;
  external_client_id?: string | null;
  client_name: string;
  client_address?: string | null;
  client_phone?: string | null;
  sessions_count: number;
  total_amount: number; // amount_cash + amount_transfer (cumul mois)
  payment_method: PaymentMethod;
  payment_date?: string | null; // ISO yyyy-mm-dd
}

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);

const formatEuro = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

/**
 * Génère un PDF de facture URSSAF conforme micro-entrepreneur pour un client.
 */
const buildSingleInvoicePdf = (params: {
  invoiceNumber: string;
  issueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  coach: CoachIssuer;
  client: InvoiceClientLine;
}): jsPDF => {
  const { invoiceNumber, issueDate, periodStart, periodEnd, coach, client } = params;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;

  // ===== Bandeau header =====
  doc.setFillColor(255, 209, 47);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text("FACTURE", margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`N° ${invoiceNumber}`, pageWidth - margin, 14, { align: "right" });

  let y = 32;

  // ===== Émetteur (Coach) =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text("ÉMETTEUR", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 5;
  const coachName = `${coach.first_name || ""} ${coach.last_name || ""}`.trim();
  doc.text(coachName, margin, y); y += 4;
  if (coach.address) {
    doc.splitTextToSize(coach.address, 80).forEach((line: string) => { doc.text(line, margin, y); y += 4; });
  }
  if (coach.phone) { doc.text(`Tél : ${coach.phone}`, margin, y); y += 4; }
  if (coach.email) { doc.text(`Email : ${coach.email}`, margin, y); y += 4; }
  if (coach.siret) { doc.text(`SIRET : ${coach.siret}`, margin, y); y += 4; }

  // ===== Destinataire (à droite) =====
  let yRight = 32;
  const xRight = pageWidth / 2 + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DESTINATAIRE", xRight, yRight);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  yRight += 5;
  doc.text(client.client_name, xRight, yRight); yRight += 4;
  if (client.client_address) {
    doc.splitTextToSize(client.client_address, 80).forEach((line: string) => {
      doc.text(line, xRight, yRight); yRight += 4;
    });
  }
  if (client.client_phone) { doc.text(`Tél : ${client.client_phone}`, xRight, yRight); yRight += 4; }

  y = Math.max(y, yRight) + 6;

  // ===== Dates =====
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Date d'émission :", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(format(issueDate, "dd/MM/yyyy", { locale: fr }), margin + 35, y);

  doc.setFont("helvetica", "bold");
  doc.text("Période de prestation :", xRight, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${format(periodStart, "dd/MM/yyyy")} au ${format(periodEnd, "dd/MM/yyyy")}`,
    xRight + 42,
    y
  );
  y += 8;

  // ===== Tableau prestations =====
  const unitPrice = client.sessions_count > 0 ? client.total_amount / client.sessions_count : client.total_amount;
  const periodLabel = format(periodStart, "MMMM yyyy", { locale: fr });
  const periodLabelCap = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

  autoTable(doc, {
    startY: y,
    head: [["Désignation", "Quantité", "Prix unitaire", "Montant HT"]],
    body: [
      [
        `Coaching sportif — ${periodLabelCap}`,
        client.sessions_count > 0 ? `${client.sessions_count} séance(s)` : "Forfait",
        client.sessions_count > 0 ? formatEuro(unitPrice) : "—",
        formatEuro(client.total_amount),
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30] },
    headStyles: { fillColor: [255, 209, 47], textColor: [30, 30, 30], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== Totaux =====
  autoTable(doc, {
    startY: y,
    body: [
      ["Total HT", formatEuro(client.total_amount)],
      ["TVA (non applicable)", "—"],
      ["TOTAL TTC à régler", formatEuro(client.total_amount)],
    ],
    margin: { left: pageWidth / 2 + 10, right: margin },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [245, 245, 245] },
      1: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [255, 209, 47];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 10;
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ===== Règlement =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("Règlement", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const paymentLabel = client.payment_method === "especes" ? "Espèces" : "Virement bancaire";
  doc.text(`Mode de paiement : ${paymentLabel}`, margin, y); y += 4;
  if (client.payment_date) {
    doc.text(`Date de règlement : ${format(new Date(client.payment_date), "dd/MM/yyyy")}`, margin, y);
    y += 4;
  }

  y += 4;

  // ===== Mentions légales obligatoires =====
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text("Mentions légales", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);

  const mentions = [
    "TVA non applicable, art. 293 B du CGI.",
    "Dispensé d'immatriculation au Registre du Commerce et des Sociétés (RCS) et au Répertoire des Métiers (RM).",
    "Pénalités de retard : taux d'intérêt légal en vigueur, sans qu'un rappel soit nécessaire (art. L.441-10 du Code de commerce).",
    "Indemnité forfaitaire pour frais de recouvrement : 40 € (art. D.441-5 du Code de commerce).",
    "Pas d'escompte pour règlement anticipé.",
  ];
  mentions.forEach((m) => {
    const lines = doc.splitTextToSize(`• ${m}`, pageWidth - 2 * margin);
    doc.text(lines, margin, y);
    y += lines.length * 3.5;
  });

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `Facture ${invoiceNumber} — émise le ${format(issueDate, "dd/MM/yyyy à HH:mm", { locale: fr })}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  return doc;
};

/**
 * Génère et archive (en base) une facture pour chaque client sélectionné, puis renvoie un ZIP.
 */
export const generateMonthlyInvoicesZip = async (params: {
  coach: CoachIssuer;
  currentMonth: Date;
  selectedClients: InvoiceClientLine[];
}): Promise<Blob> => {
  const { coach, currentMonth, selectedClients } = params;

  if (selectedClients.length === 0) {
    throw new Error("Aucun client sélectionné");
  }

  const periodStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const periodEnd = endOfMonth(periodStart);
  const issueDate = new Date();
  const year = issueDate.getFullYear();

  const zip = new JSZip();
  const monthLabel = format(currentMonth, "yyyy-MM");

  for (const client of selectedClients) {
    // 1) Réserver un numéro chronologique en base (atomique)
    const { data: nextNum, error: rpcError } = await supabase.rpc("next_invoice_number", {
      p_coach_id: coach.id,
      p_year: year,
    });
    if (rpcError) throw new Error(`Erreur numérotation: ${rpcError.message}`);

    const invoiceNumber = `FACT-${year}-${String(nextNum).padStart(4, "0")}`;

    // 2) Générer le PDF visuel
    const doc = buildSingleInvoicePdf({
      invoiceNumber,
      issueDate,
      periodStart,
      periodEnd,
      coach,
      client,
    });

    const basePdfBytes = doc.output("arraybuffer");

    // 2bis) Transformer en Factur-X EN 16931 (PDF hybride avec XML CII embarqué)
    const unitPriceHT = client.sessions_count > 0 ? client.total_amount / client.sessions_count : client.total_amount;
    const facturXData: FacturXInvoiceData = {
      invoiceNumber,
      issueDate,
      servicePeriodStart: periodStart,
      servicePeriodEnd: periodEnd,
      currency: "EUR",
      seller: {
        name: `${coach.first_name || ""} ${coach.last_name || ""}`.trim() || "Coach",
        address: coach.address,
        countryCode: "FR",
        siret: coach.siret,
        email: coach.email,
        phone: coach.phone,
      },
      buyer: {
        name: client.client_name,
        address: client.client_address,
        countryCode: "FR",
      },
      lines: [
        {
          description: `Coaching sportif — ${format(periodStart, "MMMM yyyy", { locale: fr })}`,
          quantity: client.sessions_count > 0 ? client.sessions_count : 1,
          unitCode: client.sessions_count > 0 ? "C62" : "C62",
          unitPriceHT,
          vatRate: 0, // Franchise en base TVA
        },
      ],
      vatCategory: "E",
      vatExemptionReason: "TVA non applicable, art. 293 B du CGI",
      paymentMeansCode: client.payment_method === "especes" ? "10" : "30",
      paymentDate: client.payment_date ? new Date(client.payment_date) : undefined,
    };

    const facturXBytes = await embedFacturXIntoPdf(basePdfBytes, facturXData);
    const pdfBlob = new Blob([facturXBytes as BlobPart], { type: "application/pdf" });
    const fileName = `${invoiceNumber}_${sanitize(client.client_name)}.pdf`;
    zip.file(fileName, pdfBlob);

    // 3) Archiver la facture en base (inaltérable)
    const { error: insertError } = await supabase.from("invoices").insert({
      coach_id: coach.id,
      invoice_number: invoiceNumber,
      issue_date: format(issueDate, "yyyy-MM-dd"),
      service_period_start: format(periodStart, "yyyy-MM-dd"),
      service_period_end: format(periodEnd, "yyyy-MM-dd"),
      coach_name: `${coach.first_name || ""} ${coach.last_name || ""}`.trim(),
      coach_address: coach.address || null,
      coach_siret: coach.siret || null,
      coach_phone: coach.phone || null,
      coach_email: coach.email || null,
      client_id: client.client_id || null,
      external_client_id: client.external_client_id || null,
      client_name: client.client_name,
      client_address: client.client_address || null,
      sessions_count: client.sessions_count,
      unit_price: client.sessions_count > 0 ? Number((client.total_amount / client.sessions_count).toFixed(2)) : null,
      total_amount: Number(client.total_amount.toFixed(2)),
      payment_method: client.payment_method,
      payment_date: client.payment_date || null,
      status: "issued",
    });
    if (insertError) {
      console.error("[invoice insert]", insertError);
      throw new Error(`Erreur archivage facture ${invoiceNumber}: ${insertError.message}`);
    }
  }

  return await zip.generateAsync({ type: "blob" });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
