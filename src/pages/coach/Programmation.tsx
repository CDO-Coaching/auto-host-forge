import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function Programmation() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "Coach";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Programmation</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Bienvenue {firstName} 👋</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Ici tu pourras créer et gérer les programmes d'entraînement de tes athlètes.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Fonctionnalité en cours de développement...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
