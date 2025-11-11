import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const TempoExplanationDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-purple-500/20"
        >
          <Info className="h-4 w-4 text-purple-600" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Comment fonctionne le Tempo ?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed">
          <p className="font-semibold text-base">
            Le tempo indique la vitesse d'exécution d'un mouvement.
          </p>
          
          <p>
            Il est composé de <strong>4 chiffres</strong>, toujours lus dans l'ordre du mouvement.<br />
            Ce qui change, c'est où tu commences l'exercice :
          </p>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div>
              <p className="font-semibold text-base mb-2 text-primary">
                Si l'exercice commence en haut (ex : squat, développé couché) :
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Descente</li>
                <li>Pause en bas</li>
                <li>Remontée</li>
                <li>Pause en haut</li>
              </ol>
            </div>

            <div className="border-t border-border pt-3">
              <p className="font-semibold text-base mb-2 text-primary">
                Si l'exercice commence en bas (ex : soulevé de terre) :
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Remontée</li>
                <li>Pause en haut</li>
                <li>Descente</li>
                <li>Pause en bas (barre au sol, sans rebond)</li>
              </ol>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="font-semibold mb-2">
                <span className="text-blue-600">Exemple :</span> Tempo 3-1-2-0 au squat
              </p>
              <p className="text-muted-foreground">
                → Descendre en 3 s, maintenir en bas 1 s, remonter en 2 s, repartir directement.
              </p>
            </div>

            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="font-semibold mb-2">
                <span className="text-green-600">Exemple :</span> Tempo 2-1-3-1 au deadlift
              </p>
              <p className="text-muted-foreground">
                → Monter en 2 s, tenir en haut 1 s, descendre en 3 s, 1 s au sol avant de repartir (sans rebond).
              </p>
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <p className="font-semibold mb-2">Le tempo sert à :</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
              <li>Contrôler la technique</li>
              <li>Gérer l'intensité</li>
              <li>Faire progresser plus efficacement</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
