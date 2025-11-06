import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Contact = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    message: "",
    contactMethod: "",
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.contactMethod) {
      toast({ title: "Attention", description: "Veuillez sélectionner un mode de contact", variant: "destructive" });
      return;
    }

    if (formData.contactMethod === "phone" && !formData.phone) {
      toast({
        title: "Attention",
        description: "Veuillez renseigner votre numéro de téléphone",
        variant: "destructive",
      });
      return;
    }

    if (formData.contactMethod === "email" && !formData.email) {
      toast({ title: "Attention", description: "Veuillez renseigner votre email", variant: "destructive" });
      return;
    }

    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 16).replace("T", " ");

    const { error } = await supabase.from("prise_de_contact").insert([
      {
        prénom: formData.firstName,
        nom: formData.lastName,
        email: formData.email,
        telephone: formData.phone || null,
        message: formData.message,
        mode_de_contact: formData.contactMethod === "email" ? "par email" : "par téléphone",
        created_at: formattedDate,
      },
    ]);

    if (error) {
      console.error("Erreur insertion:", error);
      toast({ title: "Erreur", description: "Une erreur est survenue", variant: "destructive" });
      return;
    }

    // ✅ Envoi de l'email via ton endpoint Lovable + Resend
    try {
      await fetch("/api/notify-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prénom: formData.firstName,
          nom: formData.lastName,
          email: formData.email,
          telephone: formData.phone || null,
          message: formData.message,
          mode_de_contact: formData.contactMethod === "email" ? "par email" : "par téléphone",
        }),
      });
      console.log("Email envoyé ✅");
    } catch (err) {
      console.error("Erreur envoi email:", err);
    }

    setShowSuccess(true);
    setFormData({ firstName: "", lastName: "", email: "", phone: "", message: "", contactMethod: "" });
    setTimeout(() => setShowSuccess(false), 4000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
          <div className="text-center animate-scale-in space-y-6 p-8">
            <div className="text-8xl mb-4">✅</div>
            <h2 className="text-6xl font-black text-primary mb-4">Message envoyé !</h2>
            <p className="text-2xl text-muted-foreground">Je te répondrai très rapidement</p>
          </div>
        </div>
      )}

      <section className="pt-32 pb-20 container mx-auto px-4 max-w-2xl">
        <h1 className="text-5xl font-black text-center mb-6">
          Restons en <span className="text-primary">Contact</span>
        </h1>

        <p className="text-center text-lg text-muted-foreground mb-10">
          Tu veux progresser, être guidé, et ne plus avancer seul ? Partage tes disponibilités ci-dessous et on organise
          ton premier échange 💪
        </p>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prénom</Label>
                <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required/>
              </div>
              <div>
                <Label>Nom</Label>
                <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required/>
              </div>
            </div>

            <div>
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required={formData.contactMethod === "email"}/>
            </div>

            <div>
              <Label>Téléphone</Label>
              <Input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required={formData.contactMethod === "phone"}/>
            </div>

            <div>
              <Label>Mode de contact préféré *</Label>
              <RadioGroup value={formData.contactMethod} onValueChange={(value) => setFormData({ ...formData, contactMethod: value })} className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="email" id="email" />
                  <Label htmlFor="email" className="cursor-pointer font-normal">Par email</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="phone" id="phone" />
                  <Label htmlFor="phone" className="cursor-pointer font-normal">Par téléphone</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>Message</Label>
              <Textarea placeholder="Partage tes créneaux où tu es dispo 😊" value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} required />
            </div>

            <Button type="submit" variant="hero" className="w-full text-lg py-6">
              Réserver mon échange 📞
            </Button>
          </form>
        </Card>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
