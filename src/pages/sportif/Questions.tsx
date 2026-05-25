import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function Questions() {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "champion";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Tes questions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {firstName}, n'hésite pas à poser toutes tes questions à ton coach
          </p>
        </div>
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
