import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Contact = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("Prise_de_contact_page_web").insert({
      Prenom: formData.firstName, Nom: formData.lastName, email: formData.email,
      message: formData.message, created_at: new Date().toISOString(), "N°": formData.phone || undefined
    });
    if (error) {
      toast({ title: "Erreur", description: "Une erreur est survenue", variant: "destructive" });
    } else {
      toast({ title: "Message envoyé !", description: "Je te répondrai rapidement." });
      setFormData({ firstName: "", lastName: "", email: "", phone: "", message: "" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <section className="pt-32 pb-20 container mx-auto px-4 max-w-2xl">
        <h1 className="text-5xl font-black text-center mb-12">Restons en <span className="text-primary">Contact</span></h1>
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Prénom</Label><Input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required /></div>
              <div><Label>Nom</Label><Input value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div>
            <div><Label>Téléphone</Label><Input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
            <div><Label>Message</Label><Textarea value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} required /></div>
            <Button type="submit" variant="hero" className="w-full">Envoyer</Button>
          </form>
        </Card>
      </section>
      <Footer />
    </div>
  );
};

export default Contact;
