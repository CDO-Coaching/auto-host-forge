import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const RPEExplanationDialog = () => {
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
          <DialogTitle className="text-2xl">Échelle RPE (Rate of Perceived Exertion)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed">
          <p className="font-semibold text-base">
            Le RPE mesure l'intensité perçue de l'effort sur une échelle de 1 à 10.
          </p>
          
          <p>
            C'est un outil pour ajuster la charge et l'intensité de ton entraînement en fonction de ton ressenti.
          </p>

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

          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <p className="font-semibold mb-2">Le RPE te permet de :</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
              <li>Ajuster la charge selon ta forme du jour</li>
              <li>Éviter le surentraînement</li>
              <li>Progresser de manière contrôlée et sûre</li>
              <li>Communiquer précisément ton ressenti à ton coach</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
