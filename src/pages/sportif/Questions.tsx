import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function Questions() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "champion";

  return (
    <div className="space-y-4 sm:space-y-6 px-3 sm:px-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Tes questions</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          {firstName}, n'hésite pas à poser toutes tes questions à ton coach
        </p>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Messagerie avec ton coach</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {firstName}, cette section te permettra bientôt d'échanger directement avec ton coach. 
            Tes questions sont importantes ! 💬
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
