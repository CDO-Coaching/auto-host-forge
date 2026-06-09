import { useAuth } from "@/contexts/AuthContext";
import { VmaCard } from "@/components/VmaCard";

export default function Physiologie() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 py-4 border-b border-border">
        <h1 className="text-lg font-bold">Données physiologiques</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tes paramètres cardio et de performance — modifiables à tout moment.
        </p>
      </div>
      <div className="px-4 sm:px-6 py-4 max-w-2xl">
        <VmaCard athleteId={user.id} isCoachView={false} />
      </div>
    </div>
  );
}
