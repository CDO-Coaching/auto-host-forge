import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function Seances() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "champion";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tes séances</h1>
        <p className="text-muted-foreground mt-2">
          {firstName}, voici ton programme d'entraînement personnalisé
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Séances à venir</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {firstName}, ton coach n'a pas encore programmé de séances. 
            Reste motivé, elles arrivent bientôt ! 💪
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
