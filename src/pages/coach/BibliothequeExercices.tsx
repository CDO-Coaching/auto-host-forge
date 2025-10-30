import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function BibliothequeExercices() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "Coach";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Bibliothèque d'exercices</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Bienvenue dans ta bibliothèque {firstName} 📚</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Ici tu pourras créer, organiser et gérer tous tes exercices d'entraînement.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Fonctionnalité en cours de développement...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
