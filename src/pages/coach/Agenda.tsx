import { Calendar } from "lucide-react";

export default function Agenda() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Agenda</h1>
      </div>
      
      <p className="text-muted-foreground">
        Page en cours de reconstruction...
      </p>
    </div>
  );
}
