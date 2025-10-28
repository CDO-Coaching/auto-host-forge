import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Seances() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mes séances</h1>
      <Card>
        <CardHeader>
          <CardTitle>Séances à venir</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aucune séance programmée pour le moment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
