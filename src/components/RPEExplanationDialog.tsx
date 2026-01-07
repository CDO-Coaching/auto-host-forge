import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RPEExplanationDialogProps {
  isCardio?: boolean;
}

export const RPEExplanationDialog = ({ isCardio = false }: RPEExplanationDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-yellow-500/20"
        >
          <Info className="h-4 w-4 text-yellow-600" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Échelle RPE {isCardio ? "Cardio" : "(Rate of Perceived Exertion)"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed">
          <p className="font-semibold text-base">
            Le RPE mesure l'intensité perçue de l'effort sur une échelle de 1 à 10.
          </p>
          
          <p>
            {isCardio 
              ? "Basé sur ta respiration et ta capacité à parler pendant l'effort."
              : "C'est un outil pour ajuster la charge et l'intensité de ton entraînement en fonction de ton ressenti."
            }
          </p>

          {isCardio ? (
            // Échelle Cardio
            <div className="space-y-2">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🟢</span>
                  <span className="font-bold text-lg text-green-600">RPE 1-2</span>
                  <span className="text-muted-foreground">Très facile</span>
                </div>
                <div className="text-sm space-y-0.5 text-muted-foreground">
                  <p><span className="text-foreground">Sensation :</span> balade, échauffement</p>
                  <p><span className="text-foreground">Respiration :</span> ultra facile, nez possible</p>
                  <p><span className="text-foreground">Parole :</span> discussion normale</p>
                  <p className="text-xs italic">→ Récupération active, footing très cool</p>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔵</span>
                  <span className="font-bold text-lg text-blue-600">RPE 3</span>
                  <span className="text-muted-foreground">Facile</span>
                </div>
                <div className="text-sm space-y-0.5 text-muted-foreground">
                  <p><span className="text-foreground">Sensation :</span> confortable</p>
                  <p><span className="text-foreground">Respiration :</span> légèrement plus rapide</p>
                  <p><span className="text-foreground">Parole :</span> phrases complètes sans problème</p>
                  <p className="text-xs italic">→ Endurance fondamentale</p>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🟡</span>
                  <span className="font-bold text-lg text-yellow-600">RPE 4</span>
                  <span className="text-muted-foreground">Modéré</span>
                </div>
                <div className="text-sm space-y-0.5 text-muted-foreground">
                  <p><span className="text-foreground">Sensation :</span> effort présent mais maîtrisé</p>
                  <p><span className="text-foreground">Respiration :</span> plus profonde</p>
                  <p><span className="text-foreground">Parole :</span> phrases courtes</p>
                  <p className="text-xs italic">→ Endurance active, sorties longues tranquilles</p>
                </div>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🟠</span>
                  <span className="font-bold text-lg text-orange-600">RPE 5</span>
                  <span className="text-muted-foreground">Soutenu</span>
                </div>
                <div className="text-sm space-y-0.5 text-muted-foreground">
                  <p><span className="text-foreground">Sensation :</span> "ça travaille"</p>
                  <p><span className="text-foreground">Respiration :</span> bien engagée</p>
                  <p><span className="text-foreground">Parole :</span> quelques mots</p>
                  <p className="text-xs italic">→ Tempo bas, allure semi cool</p>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔴</span>
                  <span className="font-bold text-lg text-red-600">RPE 6</span>
                  <span className="text-muted-foreground">Difficile</span>
                </div>
                <div className="text-sm space-y-0.5 text-muted-foreground">
                  <p><span className="text-foreground">Sensation :</span> inconfort durable</p>
                  <p><span className="text-foreground">Respiration :</span> rapide et profonde</p>
                  <p><span className="text-foreground">Parole :</span> mots isolés</p>
                  <p className="text-xs italic">→ Tempo, seuil bas</p>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔴</span>
                  <span className="font-bold text-lg text-red-600">RPE 7</span>
                  <span className="text-muted-foreground">Très difficile</span>
                </div>
                <div className="text-sm space-y-0.5 text-muted-foreground">
                  <p><span className="text-foreground">Sensation :</span> proche de la limite contrôlée</p>
                  <p><span className="text-foreground">Respiration :</span> très élevée</p>
                  <p><span className="text-foreground">Parole :</span> quasi impossible</p>
                  <p className="text-xs italic">→ Seuil haut, intervalles longs</p>
                </div>
              </div>

              <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔥</span>
                  <span className="font-bold text-lg text-red-600">RPE 8</span>
                  <span className="text-muted-foreground">Très dur</span>
                </div>
                <div className="text-sm space-y-0.5 text-muted-foreground">
                  <p><span className="text-foreground">Sensation :</span> effort maximal maintenable peu de temps</p>
                  <p><span className="text-foreground">Respiration :</span> haletante</p>
                  <p><span className="text-foreground">Parole :</span> impossible</p>
                  <p className="text-xs italic">→ V̇O₂max, intervalles courts</p>
                </div>
              </div>

              <div className="bg-red-700/10 border border-red-700/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔥</span>
                  <span className="font-bold text-lg text-red-700">RPE 9</span>
                  <span className="text-muted-foreground">Quasi maximal</span>
                </div>
                <div className="text-sm space-y-0.5 text-muted-foreground">
                  <p><span className="text-foreground">Sensation :</span> douleur, envie d'arrêter</p>
                  <p><span className="text-foreground">Respiration :</span> explosive</p>
                  <p><span className="text-foreground">Parole :</span> impossible</p>
                  <p className="text-xs italic">→ Sprints longs, fins d'intervalles</p>
                </div>
              </div>

              <div className="bg-red-900/10 border border-red-900/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">☠️</span>
                  <span className="font-bold text-lg text-red-800">RPE 10</span>
                  <span className="text-muted-foreground">Maximal</span>
                </div>
                <div className="text-sm space-y-0.5 text-muted-foreground">
                  <p><span className="text-foreground">Sensation :</span> all-out</p>
                  <p><span className="text-foreground">Respiration :</span> hors de contrôle</p>
                  <p><span className="text-foreground">Parole :</span> impossible</p>
                  <p className="text-xs italic">→ Sprint très court, test, finish</p>
                </div>
              </div>
            </div>
          ) : (
            // Échelle Musculation
            <div className="space-y-2">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg text-green-600">RPE 1-2</span>
                  <span className="text-muted-foreground">Très facile</span>
                </div>
                <p className="text-sm">Effort minimal, tu pourrais continuer indéfiniment.</p>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg text-green-600">RPE 3-4</span>
                  <span className="text-muted-foreground">Facile</span>
                </div>
                <p className="text-sm">Tu pourrais faire beaucoup plus de répétitions (5-6 reps en réserve).</p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg text-blue-600">RPE 5-6</span>
                  <span className="text-muted-foreground">Modéré</span>
                </div>
                <p className="text-sm">Effort confortable mais soutenu (3-4 reps en réserve).</p>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg text-orange-600">RPE 7-8</span>
                  <span className="text-muted-foreground">Difficile</span>
                </div>
                <p className="text-sm">Effort intense, il te reste 1-3 répétitions en réserve. Zone de travail principal.</p>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg text-red-600">RPE 9</span>
                  <span className="text-muted-foreground">Très difficile</span>
                </div>
                <p className="text-sm">Tu pourrais faire 1 répétition de plus, peut-être 2 avec effort maximal.</p>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg text-red-600">RPE 10</span>
                  <span className="text-muted-foreground">Maximal</span>
                </div>
                <p className="text-sm">Effort absolu, impossible de faire une répétition de plus.</p>
              </div>
            </div>
          )}

          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <p className="font-semibold mb-2">Le RPE te permet de :</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
              {isCardio ? (
                <>
                  <li>Adapter ton allure selon ta forme du jour</li>
                  <li>Éviter le surentraînement</li>
                  <li>Mieux cibler tes zones d'intensité</li>
                  <li>Communiquer précisément ton ressenti à ton coach</li>
                </>
              ) : (
                <>
                  <li>Ajuster la charge selon ta forme du jour</li>
                  <li>Éviter le surentraînement</li>
                  <li>Progresser de manière contrôlée et sûre</li>
                  <li>Communiquer précisément ton ressenti à ton coach</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
