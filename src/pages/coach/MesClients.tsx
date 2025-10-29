import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function MesClients() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "Coach";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mes clients</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Liste de tes athlètes, {firstName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Tu pourras visualiser et suivre l'évolution de tous tes athlètes ici.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Fonctionnalité en cours de développement...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
