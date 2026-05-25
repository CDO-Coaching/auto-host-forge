import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCardioTime, calculatePace } from "./cardioCalculations";

interface ExerciseData {
  id: string;
  exercice?: string;
  exercise_name?: string;

  series?: number;
  sets?: number;
  reps?: number;
  charge?: string | number;
  weight?: number;
  recuperation?: string;
  coach_comment?: string;
  tempo?: string;
  is_duration?: boolean;
  per_side?: boolean;

  cardio_data?: any;
  cardio_sport?: string;

  super_set_group?: string;
  exercise_order: number;

  rpe?: number;
  sportif_rpe?: number | null;
  sportif_comment?: string | null;
  sportif_feedback_at?: string | null;
}

interface SessionData {
  name: string;
  session_type: string;
  session_exercises: ExerciseData[];
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  renfo: "Renforcement",
  course: "Course à pied",
  velo: "Vélo",
  natation: "Natation",
  recup: "Récupération / Mobilité",
};

const SPORT_LABELS: Record<string, string> = {
  course: "Course à pied",
  velo: "Vélo",
  natation: "Natation",
};

// Brand color
const BRAND = { r: 255, g: 209, b: 47 };
const TEXT_DARK = { r: 30, g: 30, b: 30 };
const TEXT_MUTED = { r: 110, g: 110, b: 110 };
const SUPERSET_COLOR = { r: 255, g: 140, b: 0 };

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

const formatStepText = (step: any, athleteVma?: number | null): string => {
  const isWalking = step.movementType === "marche";
  const movementLabel = isWalking ? "Marche" : "Course";
  let text = movementLabel;

  if (step.effortType === "distance" && step.distance) {
    const unit = step.distanceUnit || "m";
    text += ` ${step.distance}${unit}`;
  } else if (step.duration) {
    text += ` ${formatCardioTime(step.duration)}`;
  }

  if (step.vmaPercentage && athleteVma && !isWalking) {
    const pace = calculatePace(step.vmaPercentage, athleteVma);
    text += ` @ ${step.vmaPercentage}% VMA (${pace})`;
  } else if (isWalking) {
    text += " @ 10:00/km";
  }

  if (step.targetHeartRate) text += ` · FC ${step.targetHeartRate} bpm`;
  if (step.recovery) text += ` · Récup ${formatCardioTime(step.recovery)}`;

  return text;
};

const buildExerciseRow = (ex: ExerciseData) => {
  const name = ex.exercice || ex.exercise_name || "Exercice";

  // Series x Reps
  const series = ex.series ?? ex.sets;
  let setsReps = "—";
  if (series || ex.reps) {
    const parts: string[] = [];
    if (series) parts.push(`${series} séries`);
    if (ex.reps) {
      if (ex.is_duration) parts.push(`${ex.reps} sec`);
      else if ((ex as any).is_distance) parts.push(`${ex.reps} m`);
      else parts.push(`${ex.reps} reps${ex.per_side ? " /côté" : ""}`);
    }
    setsReps = parts.join(" × ");
  }

  const charge = ex.charge ?? ex.weight;
  const chargeStr = charge !== undefined && charge !== null && charge !== "" ? String(charge) : "—";
  const recup = ex.recuperation || "—";
  const tempo = ex.tempo || "—";
  const rpePresc = typeof ex.rpe === "number" ? String(ex.rpe) : "—";

  let rpeFelt = "—";
  if (ex.sportif_rpe !== null && ex.sportif_rpe !== undefined) {
    rpeFelt = String(ex.sportif_rpe);
    if (ex.sportif_feedback_at) rpeFelt += `\n(${formatDateTime(ex.sportif_feedback_at)})`;
  }

  return { name, setsReps, chargeStr, recup, tempo, rpePresc, rpeFelt };
};

const renderCommentsBlock = (doc: jsPDF, ex: ExerciseData, startY: number, margin: number, pageWidth: number): number => {
  let y = startY;
  const innerWidth = pageWidth - 2 * margin - 4;

  if (ex.coach_comment) {
    doc.setFillColor(255, 248, 220);
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setLineWidth(0.3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120, 90, 0);
    const label = "Commentaire coach :";
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(ex.coach_comment, innerWidth - 4);
    const blockH = 5 + lines.length * 4 + 2;
    doc.rect(margin, y, pageWidth - 2 * margin, blockH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 90, 0);
    doc.text(label, margin + 2, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(lines, margin + 2, y + 8);
    y += blockH + 1;
  }

  if (ex.sportif_comment) {
    doc.setFillColor(235, 245, 255);
    doc.setDrawColor(100, 150, 200);
    doc.setLineWidth(0.3);
    const lines = doc.splitTextToSize(ex.sportif_comment, innerWidth - 4);
    const blockH = 5 + lines.length * 4 + 2;
    doc.rect(margin, y, pageWidth - 2 * margin, blockH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40, 80, 140);
    doc.text("Commentaire athlète :", margin + 2, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(lines, margin + 2, y + 8);
    y += blockH + 1;
  }

  return y;
};

const renderStandardExerciseTable = (
  doc: jsPDF,
  exercises: ExerciseData[],
  startY: number,
  margin: number,
  pageWidth: number,
  options: { isSuperset?: boolean; supersetLabel?: string } = {}
): number => {
  const rows = exercises.map((ex) => {
    const r = buildExerciseRow(ex);
    return [r.name, r.setsReps, r.chargeStr, r.recup, r.tempo, r.rpePresc, r.rpeFelt];
  });

  let currentY = startY;

  if (options.isSuperset) {
    doc.setFillColor(SUPERSET_COLOR.r, SUPERSET_COLOR.g, SUPERSET_COLOR.b);
    doc.rect(margin, currentY, pageWidth - 2 * margin, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(options.supersetLabel || "SUPERSET", margin + 2, currentY + 5);
    currentY += 7;
  }

  autoTable(doc, {
    startY: currentY,
    head: [["Exercice", "Séries × Reps", "Charge", "Récup", "Tempo", "RPE prescrit", "RPE ressenti"]],
    body: rows,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      overflow: "linebreak",
      valign: "middle",
      textColor: [TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b],
    },
    headStyles: {
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: [30, 30, 30],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 18, halign: "center" },
      6: { cellWidth: "auto", halign: "center" },
    },
  });

  let endY = (doc as any).lastAutoTable.finalY + 2;

  // Comments per exercise (only if any)
  exercises.forEach((ex) => {
    if (ex.coach_comment || ex.sportif_comment) {
      // Add small label with exercise name
      const exName = ex.exercice || ex.exercise_name || "Exercice";
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text(`▸ ${exName}`, margin, endY + 3);
      endY += 4;
      endY = renderCommentsBlock(doc, ex, endY, margin, pageWidth);
    }
  });

  return endY + 4;
};

const renderCardioExercise = (
  doc: jsPDF,
  exercise: ExerciseData,
  startY: number,
  margin: number,
  pageWidth: number,
  athleteVma?: number | null
): number => {
  const sportLabel = SPORT_LABELS[exercise.cardio_sport || "course"] || "Cardio";

  // Header
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(margin, startY, pageWidth - 2 * margin, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(sportLabel, margin + 2, startY + 5);
  let y = startY + 7;

  // Build rows from cardio_data steps
  const rows: any[] = [];
  if (exercise.cardio_data) {
    let cardioData;
    try {
      cardioData = typeof exercise.cardio_data === "string" ? JSON.parse(exercise.cardio_data) : exercise.cardio_data;
    } catch {
      cardioData = { steps: [] };
    }
    const steps = cardioData.steps || [];
    steps.forEach((step: any, i: number) => {
      if (step.type === "block") {
        rows.push([
          { content: `Bloc × ${step.repetitions || 1}`, colSpan: 2, styles: { fillColor: [255, 235, 180], fontStyle: "bold" } },
        ]);
        (step.steps || []).forEach((sub: any, j: number) => {
          rows.push([`  ${j + 1}.`, formatStepText(sub, athleteVma)]);
        });
        if (step.recovery) {
          rows.push([{ content: `Récup bloc : ${formatCardioTime(step.recovery)}`, colSpan: 2, styles: { fontStyle: "italic", textColor: [110, 110, 110] } }]);
        }
      } else {
        rows.push([`${i + 1}.`, formatStepText(step, athleteVma)]);
      }
    });
  }

  if (rows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Étape"]],
      body: rows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2, valign: "middle", textColor: [TEXT_DARK.r, TEXT_DARK.g, TEXT_DARK.b] },
      headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 14, halign: "center" }, 1: { cellWidth: "auto" } },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  }

  // RPE summary table
  const rpePresc = typeof exercise.rpe === "number" ? String(exercise.rpe) : "—";
  let rpeFelt = "—";
  if (exercise.sportif_rpe !== null && exercise.sportif_rpe !== undefined) {
    rpeFelt = String(exercise.sportif_rpe);
    if (exercise.sportif_feedback_at) rpeFelt += ` (${formatDateTime(exercise.sportif_feedback_at)})`;
  }

  if (rpePresc !== "—" || rpeFelt !== "—") {
    autoTable(doc, {
      startY: y,
      body: [["RPE prescrit", rpePresc, "RPE ressenti", rpeFelt]],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [245, 245, 245], cellWidth: 35 },
        1: { halign: "center", cellWidth: 30 },
        2: { fontStyle: "bold", fillColor: [245, 245, 245], cellWidth: 35 },
        3: { halign: "center" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  }

  y = renderCommentsBlock(doc, exercise, y, margin, pageWidth);

  return y + 4;
};

export const exportSessionToPdf = (session: SessionData, athleteVma?: number | null) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ===== Header band =====
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(session.name, margin, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(SESSION_TYPE_LABELS[session.session_type] || session.session_type, margin, 18);

  const now = new Date();
  const dateStr = `${now.toLocaleDateString("fr-FR")} · ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  doc.setFontSize(9);
  doc.text(dateStr, pageWidth - margin, 18, { align: "right" });

  let y = 30;

  // ===== Group exercises =====
  const exercises = session.session_exercises || [];
  const grouped: any[] = [];
  const processed = new Set<string>();

  exercises.forEach((ex) => {
    if (ex.super_set_group && !processed.has(ex.super_set_group)) {
      processed.add(ex.super_set_group);
      const supersetExercises = exercises
        .filter((e) => e.super_set_group === ex.super_set_group)
        .sort((a, b) => a.exercise_order - b.exercise_order);
      grouped.push({ isSuperset: true, exercises: supersetExercises });
    } else if (!ex.super_set_group) {
      grouped.push(ex);
    }
  });

  grouped.sort((a, b) => {
    const oa = a.isSuperset ? a.exercises[0].exercise_order : a.exercise_order;
    const ob = b.isSuperset ? b.exercises[0].exercise_order : b.exercise_order;
    return oa - ob;
  });

  // ===== Render each group =====
  grouped.forEach((item) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }

    if (item.isSuperset) {
      y = renderStandardExerciseTable(doc, item.exercises, y, margin, pageWidth, {
        isSuperset: true,
        supersetLabel: `SUPERSET — ${item.exercises.length} exercices enchaînés`,
      });
    } else if (item.cardio_data || item.cardio_sport) {
      y = renderCardioExercise(doc, item, y, margin, pageWidth, athleteVma);
    } else {
      y = renderStandardExerciseTable(doc, [item], y, margin, pageWidth);
    }
  });

  // ===== Footer on every page =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    doc.text(`Exporté le ${dateStr}`, margin, pageHeight - 6);
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  const fileName = `${session.name.replace(/[^a-zA-Z0-9]/g, "_")}_${now.toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};
