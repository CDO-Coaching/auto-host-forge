import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Fatigue() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mon suivi fatigue</h1>
      <Card>
        <CardHeader>
          <CardTitle>Suivi de la fatigue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aucune donnée de fatigue enregistrée pour le moment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
