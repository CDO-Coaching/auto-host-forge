import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function Fatigue() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "champion";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ton suivi fatigue</h1>
        <p className="text-muted-foreground mt-2">
          {firstName}, suis ton niveau de fatigue pour optimiser tes performances
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Niveau de fatigue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {firstName}, commence à enregistrer tes données de fatigue pour que ton coach 
            puisse adapter ton programme. L'écoute de ton corps est essentielle ! 🎯
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
