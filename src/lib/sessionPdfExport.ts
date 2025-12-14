import jsPDF from "jspdf";
import { formatCardioTime, calculatePace } from "./cardioCalculations";

interface ExerciseData {
  id: string;
  exercise_name: string;
  sets?: number;
  reps?: number;
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
}

interface SessionData {
  name: string;
  session_type: string;
  session_exercises: ExerciseData[];
}

export const exportSessionToPdf = (session: SessionData, athleteVma?: number | null) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = 20;
  const lineHeight = 7;

  // Titre de la séance
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(session.name, margin, yPosition);
  yPosition += 12;

  // Type de séance
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const sessionTypeLabels: Record<string, string> = {
    renfo: "Renforcement",
    course: "Course à pied",
    velo: "Vélo",
    natation: "Natation",
    recup: "Récupération / Mobilité",
  };
  doc.text(`Type: ${sessionTypeLabels[session.session_type] || session.session_type}`, margin, yPosition);
  yPosition += 15;

  // Regrouper les exercices par superset
  const exercises = session.session_exercises || [];
  const grouped: any[] = [];
  const processedGroups = new Set<string>();

  exercises.forEach((exercise) => {
    if (exercise.super_set_group && !processedGroups.has(exercise.super_set_group)) {
      processedGroups.add(exercise.super_set_group);
      const supersetExercises = exercises.filter((ex) => ex.super_set_group === exercise.super_set_group);
      grouped.push({
        isSuperset: true,
        super_set_group: exercise.super_set_group,
        exercises: supersetExercises.sort((a, b) => a.exercise_order - b.exercise_order),
      });
    } else if (!exercise.super_set_group) {
      grouped.push(exercise);
    }
  });

  grouped.sort((a, b) => {
    const orderA = a.isSuperset ? a.exercises[0].exercise_order : a.exercise_order;
    const orderB = b.isSuperset ? b.exercises[0].exercise_order : b.exercise_order;
    return orderA - orderB;
  });

  // Fonction pour vérifier si on a besoin d'une nouvelle page
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Afficher chaque exercice
  grouped.forEach((item, index) => {
    checkNewPage(50);

    if (item.isSuperset) {
      // Superset header
      doc.setFillColor(255, 165, 0);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(`SUPERSET (${item.exercises.length} exercices)`, margin + 3, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 12;

      // Afficher chaque exercice du superset
      item.exercises.forEach((ex: ExerciseData, exIndex: number) => {
        checkNewPage(40);
        renderExercise(doc, ex, margin + 5, yPosition, pageWidth, athleteVma);
        yPosition += calculateExerciseHeight(ex);
      });

      yPosition += 5;
    } else if (item.cardio_data || item.cardio_sport) {
      // Exercice cardio
      renderCardioExercise(doc, item, margin, yPosition, pageWidth, athleteVma);
      yPosition += calculateCardioHeight(item);
    } else {
      // Exercice standard
      renderExercise(doc, item, margin, yPosition, pageWidth, athleteVma);
      yPosition += calculateExerciseHeight(item);
    }
  });

  // Date d'export
  checkNewPage(20);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(128, 128, 128);
  const now = new Date();
  doc.text(
    `Exporté le ${now.toLocaleDateString("fr-FR")} à ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    margin,
    doc.internal.pageSize.getHeight() - 10
  );

  // Télécharger le PDF
  const fileName = `${session.name.replace(/[^a-zA-Z0-9]/g, "_")}_${now.toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
};

const renderExercise = (
  doc: jsPDF,
  exercise: ExerciseData,
  x: number,
  y: number,
  pageWidth: number,
  athleteVma?: number | null
) => {
  const margin = 20;
  
  // Nom de l'exercice
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(exercise.exercise_name || "Exercice", x, y);

  // Détails
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let detailY = y + 7;

  // Séries x Répétitions
  if (exercise.sets || exercise.reps) {
    let setsRepsText = "";
    if (exercise.sets) setsRepsText += `${exercise.sets} séries`;
    if (exercise.reps) {
      if (exercise.is_duration) {
        setsRepsText += ` x ${exercise.reps}s`;
      } else {
        setsRepsText += ` x ${exercise.reps} reps`;
        if (exercise.per_side) setsRepsText += " (par côté)";
      }
    }
    doc.text(setsRepsText, x, detailY);
    detailY += 5;
  }

  // Charge
  if (exercise.weight) {
    doc.text(`Charge: ${exercise.weight} kg`, x, detailY);
    detailY += 5;
  }

  // Récupération
  if (exercise.recuperation) {
    doc.text(`Récup: ${exercise.recuperation}`, x, detailY);
    detailY += 5;
  }

  // Tempo
  if (exercise.tempo) {
    doc.text(`Tempo: ${exercise.tempo}`, x, detailY);
    detailY += 5;
  }

  // Commentaire coach
  if (exercise.coach_comment) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    const lines = doc.splitTextToSize(`💬 ${exercise.coach_comment}`, pageWidth - x - margin);
    doc.text(lines, x, detailY);
    doc.setTextColor(0, 0, 0);
  }
};

const renderCardioExercise = (
  doc: jsPDF,
  exercise: ExerciseData,
  x: number,
  y: number,
  pageWidth: number,
  athleteVma?: number | null
) => {
  const margin = 20;
  
  // Header cardio
  const sportLabels: Record<string, string> = {
    course: "🏃 Course à pied",
    velo: "🚴 Vélo",
    natation: "🏊 Natation",
  };
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(sportLabels[exercise.cardio_sport || "course"] || "Cardio", x, y);

  let detailY = y + 10;

  // Parser les données cardio
  if (exercise.cardio_data) {
    let cardioData;
    try {
      cardioData = typeof exercise.cardio_data === "string" 
        ? JSON.parse(exercise.cardio_data) 
        : exercise.cardio_data;
    } catch {
      cardioData = { steps: [] };
    }

    const steps = cardioData.steps || [];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    steps.forEach((step: any, index: number) => {
      if (step.type === "block") {
        // Bloc répétable
        doc.setFont("helvetica", "bold");
        doc.text(`Bloc x${step.repetitions || 1}`, x, detailY);
        doc.setFont("helvetica", "normal");
        detailY += 6;

        (step.steps || []).forEach((subStep: any, subIndex: number) => {
          const stepText = formatStepText(subStep, athleteVma);
          doc.text(`  • ${stepText}`, x, detailY);
          detailY += 5;
        });

        if (step.recovery) {
          doc.text(`  Récup bloc: ${formatCardioTime(step.recovery)}`, x, detailY);
          detailY += 5;
        }
        detailY += 3;
      } else {
        // Étape simple
        const stepText = formatStepText(step, athleteVma);
        doc.text(`${index + 1}. ${stepText}`, x, detailY);
        detailY += 6;
      }
    });
  }

  // Commentaire coach
  if (exercise.coach_comment) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    const lines = doc.splitTextToSize(`💬 ${exercise.coach_comment}`, pageWidth - x - margin);
    doc.text(lines, x, detailY);
    doc.setTextColor(0, 0, 0);
  }
};

const formatStepText = (step: any, athleteVma?: number | null): string => {
  const isWalking = step.movementType === "marche";
  const movementLabel = isWalking ? "Marche" : "Course";
  
  let text = movementLabel;

  // Distance ou durée
  if (step.effortType === "distance" && step.distance) {
    const distanceValue = step.distanceUnit === "km" ? step.distance : step.distance;
    const unit = step.distanceUnit || "m";
    text += ` - ${distanceValue}${unit}`;
  } else if (step.duration) {
    text += ` - ${formatCardioTime(step.duration)}`;
  }

  // Allure - correction de l'ordre des paramètres
  if (step.vmaPercentage && athleteVma && !isWalking) {
    const pace = calculatePace(step.vmaPercentage, athleteVma);
    text += ` @ ${step.vmaPercentage}% VMA (${pace})`;
  } else if (isWalking) {
    text += " @ 10:00/km";
  }

  // FC cible
  if (step.targetHeartRate) {
    text += ` - FC: ${step.targetHeartRate} bpm`;
  }

  return text;
};

const calculateExerciseHeight = (exercise: ExerciseData): number => {
  let height = 20; // Base height for name
  if (exercise.sets || exercise.reps) height += 5;
  if (exercise.weight) height += 5;
  if (exercise.recuperation) height += 5;
  if (exercise.tempo) height += 5;
  if (exercise.coach_comment) height += 10;
  return height + 5; // Padding
};

const calculateCardioHeight = (exercise: ExerciseData): number => {
  let height = 20;
  
  if (exercise.cardio_data) {
    let cardioData;
    try {
      cardioData = typeof exercise.cardio_data === "string" 
        ? JSON.parse(exercise.cardio_data) 
        : exercise.cardio_data;
    } catch {
      cardioData = { steps: [] };
    }

    const steps = cardioData.steps || [];
    steps.forEach((step: any) => {
      if (step.type === "block") {
        height += 10 + (step.steps?.length || 0) * 6;
        if (step.recovery) height += 5;
      } else {
        height += 6;
      }
    });
  }

  if (exercise.coach_comment) height += 10;
  return height + 10;
};
