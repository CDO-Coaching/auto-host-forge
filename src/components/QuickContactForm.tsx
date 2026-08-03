import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2 } from "lucide-react";

/**
 * Formulaire de contact rapide (accueil). La demande est enregistrée dans
 * prise_de_contact (visible dans l'espace Admin) + webhook n8n.
 */
export function QuickContactForm() {
  const { toast } = useToast();
  const [data, setData] = useState({ firstName: "", email: "", phone: "", message: "" });
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (method === "email" && !data.email) { toast({ title: "Ton email est requis", variant: "destructive" }); return; }
    if (method === "phone" && !data.phone) { toast({ title: "Ton téléphone est requis", variant: "destructive" }); return; }

    setSending(true);
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 16).replace("T", " ");
    const payload = {
      prénom: data.firstName,
      nom: "",
      email: data.email,
      telephone: data.phone || null,
      message: data.message,
      mode_de_contact: method === "email" ? "par email" : "par téléphone",
    };

    const { error } = await supabase.from("prise_de_contact").insert([{ ...payload, created_at: formattedDate }]);
    if (error) {
      setSending(false);
      toast({ title: "Erreur", description: "Réessaie dans un instant", variant: "destructive" });
      return;
    }
    try {
      await fetch("https://n8n-i4coc8gkwgok0s4k0gsscsgw.168.231.84.252.sslip.io/webhook/8742a3d9-f3e7-437a-b475-aa898f5509d9", {
        method: "POST", headers: { "Content-Type": "application/json" }, mode: "no-cors",
        body: JSON.stringify(payload),
      });
    } catch { /* non bloquant */ }

    setSending(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-card p-8 text-center space-y-3">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
        <h3 className="text-2xl font-bold">Message envoyé !</h3>
        <p className="text-muted-foreground">Je te recontacte très vite {method === "email" ? "par email" : "par téléphone"} 💪</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-intense">
      <div>
        <h3 className="text-xl font-bold">Contacte-moi</h3>
        <p className="text-sm text-muted-foreground">Réponse rapide, sans engagement.</p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Prénom</Label>
        <Input value={data.firstName} onChange={(e) => setData({ ...data, firstName: e.target.value })} required placeholder="Ton prénom" />
      </div>

      {/* Choix du mode de contact */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMethod("email")}
          className={`text-sm rounded-lg border py-2 font-medium transition-colors ${method === "email" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          Par email
        </button>
        <button type="button" onClick={() => setMethod("phone")}
          className={`text-sm rounded-lg border py-2 font-medium transition-colors ${method === "phone" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          Par téléphone
        </button>
      </div>

      {method === "email" ? (
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} required placeholder="ton@email.com" />
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs">Téléphone</Label>
          <Input type="tel" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} required placeholder="06 12 34 56 78" />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Ton message</Label>
        <Textarea value={data.message} onChange={(e) => setData({ ...data, message: e.target.value })} required rows={3}
          placeholder="Ton objectif, tes dispos… (ex : je veux reprendre le sport, dispo en soirée)" />
      </div>

      <Button type="submit" variant="hero" className="w-full" disabled={sending}>
        {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Envoyer ma demande
      </Button>
    </form>
  );
}
