import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Download, Check } from "lucide-react";

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si l'app est déjà installée
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Écouter l'événement beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Installer l'application</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Installe CDO Coaching sur ton téléphone pour un accès rapide
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Application mobile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInstalled ? (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-500">Application installée !</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tu peux maintenant utiliser CDO Coaching depuis ton écran d'accueil
                </p>
              </div>
            </div>
          ) : isInstallable ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Installe l'application pour profiter d'une meilleure expérience :
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Accès rapide depuis ton écran d'accueil</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Fonctionne hors ligne</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Performances optimisées</span>
                </li>
              </ul>
              <Button onClick={handleInstall} className="w-full gap-2">
                <Download className="h-4 w-4" />
                Installer l'application
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pour installer l'application sur ton téléphone :
              </p>

              <div className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-semibold text-sm mb-2">Sur iPhone (Safari)</p>
                  <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                    <li>Appuie sur le bouton Partager</li>
                    <li>Sélectionne "Sur l'écran d'accueil"</li>
                    <li>Confirme l'ajout</li>
                  </ol>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-semibold text-sm mb-2">Sur Android (Chrome)</p>
                  <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                    <li>Ouvre le menu (⋮)</li>
                    <li>Sélectionne "Installer l'application"</li>
                    <li>Confirme l'installation</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
