import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, X, Loader2, CheckCircle2, ShieldCheck, Eye, EyeOff, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  SFMS_QUESTIONS,
  SFMS_DIMENSIONS,
  getSfmsInterpretation,
  computeDimensionScores,
  type SfmsDimension,
} from "@/lib/sfmsQuestions";

export default function QuestionnaireSurentrainement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [showResult, setShowResult] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [started, setStarted] = useState(false);
  const savingRef = useRef(false);

  const total = SFMS_QUESTIONS.length;
  const current = SFMS_QUESTIONS[step];
  const progress = ((step + (showResult ? 1 : 0)) / total) * 100;

  const handleAnswer = (value: boolean) => {
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
    if (step < total - 1) {
      setStep((s) => s + 1);
    } else {
      setShowResult(true);
    }
  };

  const handleBack = () => {
    if (showResult) {
      // Une fois enregistré, on bloque le retour (résultat déjà envoyé au coach)
      if (saved || saving) return;
      setShowResult(false);
      return;
    }
    if (step > 0) setStep((s) => s - 1);
  };

  const totalScore = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers]
  );

  const { scores, totals } = useMemo(
    () => computeDimensionScores(answers),
    [answers]
  );

  const interpretation = getSfmsInterpretation(totalScore);

  const dominantDimension = useMemo(() => {
    const entries = (Object.keys(scores) as SfmsDimension[]).map((k) => ({
      key: k,
      ratio: totals[k] > 0 ? scores[k] / totals[k] : 0,
      raw: scores[k],
    }));
    entries.sort((a, b) => b.ratio - a.ratio || b.raw - a.raw);
    return entries[0];
  }, [scores, totals]);

  // Enregistrement automatique + notification du coach à l'arrivée sur le résultat
  useEffect(() => {
    if (!showResult || saved || savingRef.current) return;
    savingRef.current = true;
    (async () => {
      try {
        setSaving(true);
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes.user;
        if (!user) throw new Error("Non authentifié");

        const { data: inserted, error } = await supabase
          .from("sfms_questionnaire_results")
          .insert({
            athlete_id: user.id,
            total_score: totalScore,
            answers,
            score_fatigue_physique: scores.fatigue_physique,
            score_performance: scores.performance,
            score_psychologique: scores.psychologique,
            score_cognitif: scores.cognitif,
            score_sommeil_appetit: scores.sommeil_appetit,
            score_physiologique: scores.physiologique,
          })
          .select("id")
          .single();
        if (error) throw error;

        // Marquer toutes les demandes pending de cet athlète comme complétées
        await supabase
          .from("sfms_questionnaire_requests")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            result_id: inserted?.id ?? null,
          })
          .eq("athlete_id", user.id)
          .eq("status", "pending");

        // Nettoyer le snooze de session pour cet athlète
        sessionStorage.removeItem(`sfms-snooze-${user.id}`);

        setSaved(true);
        toast({
          title: "Résultat enregistré",
          description: "Ton coach pourra le consulter sur ton profil.",
        });

        // Génération du retour personnalisé via IA (visible uniquement par le coach)
        try {
          const { data: aiData, error: aiError } = await supabase.functions.invoke(
            "generate-sfms-feedback",
            {
              body: {
                totalScore,
                scores: {
                  fatigue_physique: scores.fatigue_physique,
                  performance: scores.performance,
                  psychologique: scores.psychologique,
                  cognitif: scores.cognitif,
                  sommeil_appetit: scores.sommeil_appetit,
                  physiologique: scores.physiologique,
                },
              },
            }
          );
          if (aiError) throw aiError;
          const feedback = (aiData as any)?.feedback as string | undefined;
          if (feedback && inserted?.id) {
            await supabase
              .from("sfms_questionnaire_results")
              .update({ ai_feedback: feedback })
              .eq("id", inserted.id);
          }
        } catch (aiErr: any) {
          console.error("AI feedback error:", aiErr);
        }
      } catch (e: any) {
        savingRef.current = false;
        toast({
          title: "Erreur",
          description: e.message || "Impossible d'enregistrer le résultat.",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    })();
  }, [showResult, saved, totalScore, answers, scores, toast]);

  if (showResult) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sportif/fatigue")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour à Fatigue
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Résultat du questionnaire</CardTitle>
            <p className="text-sm text-muted-foreground">
              Questionnaire SFMS – Société Française de Médecine du Sport
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <div className="text-6xl font-bold">{totalScore}<span className="text-2xl text-muted-foreground">/54</span></div>
              <div className={`text-lg font-semibold ${interpretation.colorClass}`}>
                {interpretation.label}
              </div>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                {interpretation.description}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Dominance par dimension</h3>
              {(Object.keys(SFMS_DIMENSIONS) as SfmsDimension[])
                .map((k) => ({
                  key: k,
                  label: SFMS_DIMENSIONS[k].label,
                  color: SFMS_DIMENSIONS[k].color,
                  raw: scores[k],
                  total: totals[k],
                  ratio: totals[k] > 0 ? (scores[k] / totals[k]) * 100 : 0,
                }))
                .sort((a, b) => b.ratio - a.ratio)
                .map((d) => (
                  <div key={d.key} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                        {d.label}
                        {d.key === dominantDimension.key && d.raw > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                            Dominante
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {d.raw}/{d.total}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${d.ratio}%`, backgroundColor: d.color }}
                      />
                    </div>
                  </div>
                ))}
            </div>

            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
              <p className="font-medium">Repères d'interprétation du score total :</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>Moins de 10 : pas de signe particulier</li>
                <li>10 à 19 : fatigue à surveiller</li>
                <li>20 à 26 : seuil d'alerte, possible surentraînement</li>
                <li>27 et plus : surentraînement probable</li>
              </ul>
            </div>


            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="text-sm flex items-center gap-2">
                {saving && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Enregistrement de ton résultat…
                    </span>
                  </>
                )}
                {saved && (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Résultat enregistré — visible par ton coach
                    </span>
                  </>
                )}
              </div>
              <Button onClick={() => navigate("/sportif/fatigue")} disabled={saving}>
                Retour à Fatigue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sportif/fatigue")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour à Fatigue
        </Button>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <CardTitle>Avant de commencer — confidentialité</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Réponds en toute honnêteté. Voici exactement ce que ton coach verra (ou non).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <Eye className="h-4 w-4" />
                Ce que ton coach verra
              </div>
              <ul className="list-disc list-inside text-sm space-y-1 text-foreground/90">
                <li>Ton <strong>score global</strong> (sur 54) et son interprétation (OK, à surveiller, alerte, critique)</li>
                <li>La <strong>date</strong> à laquelle tu as rempli le questionnaire</li>
                <li>Le <strong>détail des scores par dimension</strong> (fatigue physique, performance, psychologique, cognitif, sommeil/appétit, physiologique) afin d'adapter au mieux ton entraînement</li>
                <li>Des <strong>recommandations</strong> automatiques basées sur ces scores</li>
              </ul>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <EyeOff className="h-4 w-4" />
                Ce que ton coach ne verra JAMAIS
              </div>
              <ul className="list-disc list-inside text-sm space-y-1 text-foreground/90">
                <li>Tes <strong>réponses individuelles</strong> à chaque question (oui/non)</li>
                <li>Le détail des questions auxquelles tu as répondu oui ou non</li>
              </ul>
            </div>

            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <Info className="h-4 w-4 text-muted-foreground" />
                Bon à savoir
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-1">
                <li>54 questions oui/non, environ 5 minutes</li>
                <li>Réponds en pensant au <strong>mois écoulé</strong></li>
                <li>Plus tu es honnête, plus ton coach pourra t'aider efficacement</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => navigate("/sportif/fatigue")}>
                Annuler
              </Button>
              <Button onClick={() => setStarted(true)}>
                J'ai compris, commencer
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/sportif/fatigue")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Retour à Fatigue
      </Button>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Questionnaire de surentraînement</CardTitle>
          <p className="text-sm text-muted-foreground">
            Réponds en pensant au <strong>mois écoulé</strong>. 54 questions oui/non.
          </p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Question {step + 1} / {total}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="min-h-[100px] flex items-center justify-center text-center">
            <p className="text-lg font-medium">{current.text}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              variant={answers[current.id] === false ? "default" : "outline"}
              onClick={() => handleAnswer(false)}
              className="h-16"
            >
              <X className="h-5 w-5 mr-2" /> Non
            </Button>
            <Button
              size="lg"
              variant={answers[current.id] === true ? "default" : "outline"}
              onClick={() => handleAnswer(true)}
              className="h-16"
            >
              <Check className="h-5 w-5 mr-2" /> Oui
            </Button>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" size="sm" onClick={handleBack} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Précédent
            </Button>
            {step < total - 1 && answers[current.id] !== undefined && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s + 1)}>
                Suivant <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
