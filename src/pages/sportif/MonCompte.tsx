import { useEffect, useState } from "react";
import { User, Bell, CreditCard, FileText, HelpCircle, Shield } from "lucide-react";
import { HubGrid, HubTile } from "@/components/HubGrid";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function MonCompte() {
  const { user } = useAuth();
  const [paymentEnabled, setPaymentEnabled] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("payment_enabled")
        .eq("id", user.id)
        .single();
      if (!error && data) setPaymentEnabled(data.payment_enabled || false);
    };
    check();
  }, [user]);

  const tiles: HubTile[] = [
    { title: "Mon profil", description: "Infos personnelles", url: "/sportif/profil", icon: User },
    { title: "Notifications", description: "Préférences d'alertes", url: "/sportif/notifications", icon: Bell },
    ...(paymentEnabled
      ? [
          { title: "Mes paiements", url: "/sportif/paiement", icon: CreditCard } as HubTile,
          { title: "Mes factures", url: "/sportif/factures", icon: FileText } as HubTile,
        ]
      : []),
    { title: "Aide", description: "Questions & support", url: "/sportif/aide", icon: HelpCircle },
    { title: "Politique RGPD", description: "Confidentialité", url: "/politique-rgpd", icon: Shield },
  ];

  return <HubGrid title="Mon compte" tiles={tiles} />;
}
