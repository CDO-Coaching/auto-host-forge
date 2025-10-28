import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Questions() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mes questions</h1>
      <Card>
        <CardHeader>
          <CardTitle>Questions posées</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Aucune question pour le moment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
