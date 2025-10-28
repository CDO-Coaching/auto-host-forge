import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function Questions() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "champion";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tes questions</h1>
        <p className="text-muted-foreground mt-2">
          {firstName}, n'hésite pas à poser toutes tes questions à ton coach
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Messagerie avec ton coach</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {firstName}, cette section te permettra bientôt d'échanger directement avec ton coach. 
            Tes questions sont importantes ! 💬
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
