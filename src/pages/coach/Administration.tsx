import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, UserX, Mail, Phone, ShieldAlert, Inbox, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_EMAIL = "cdo.personaltrainer@gmail.com";

interface PendingUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  created_at: string | null;
}

interface Contact {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  message: string | null;
  mode_de_contact: string | null;
  traite: boolean;
  created_at: string | null;
}

export default function Administration() {
  const { user } = useAuth();
  const isAdmin = (user?.email || "").toLowerCase() === ADMIN_EMAIL;

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [showTreated, setShowTreated] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([
        supabase.rpc("admin_list_pending_users"),
        supabase.rpc("admin_list_contacts"),
      ]);
      if (u.error) throw u.error;
      if (c.error) throw c.error;
      setPending((u.data || []) as PendingUser[]);
      setContacts((c.data || []) as Contact[]);
    } catch (e: any) {
      toast.error(`Erreur de chargement : ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin]);

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_approve_user", { p_user_id: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    setPending((p) => p.filter((u) => u.id !== id));
    toast.success("Accès accordé.");
  };

  const refuse = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_refuse_user", { p_user_id: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    setPending((p) => p.filter((u) => u.id !== id));
    toast.success("Demande refusée.");
  };

  const markContact = async (id: string, traite: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("admin_mark_contact", { p_id: id, p_traite: traite });
    setBusy(null);
    if (error) return toast.error(error.message);
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, traite } : c)));
  };

  const fullName = (a?: string | null, b?: string | null) =>
    `${a || ""} ${b || ""}`.trim() || "—";

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <p className="text-foreground font-medium">Accès réservé</p>
        <p className="text-sm text-muted-foreground">Cet espace est réservé à l'administrateur.</p>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Chargement…</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Administration</h1>
        <p className="text-sm text-muted-foreground">Demandes d'accès et de contact.</p>
      </div>

      {/* Demandes d'accès */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Demandes d'accès
            {pending.length > 0 && <Badge variant="secondary" className="ml-auto text-xs">{pending.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Aucune demande en attente.</p>
          ) : (
            pending.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{fullName(u.first_name, u.last_name)}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}{u.role ? ` · ${u.role}` : ""}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-green-500 border-green-500/50 hover:bg-green-500/10"
                  disabled={busy === u.id} onClick={() => approve(u.id)}>
                  <UserCheck className="h-3.5 w-3.5 mr-1" /> Accepter
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/40 hover:bg-destructive/10"
                  disabled={busy === u.id} onClick={() => refuse(u.id)}>
                  <UserX className="h-3.5 w-3.5 mr-1" /> Refuser
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Demandes de contact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            Demandes de contact
            {contacts.filter((c) => !c.traite).length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">{contacts.filter((c) => !c.traite).length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(() => {
            const untreated = contacts.filter((c) => !c.traite);
            const treated = contacts.filter((c) => c.traite);

            const renderContact = (c: Contact) => (
              <div key={c.id} className={`p-3 rounded-lg border ${c.traite ? "border-border opacity-70" : "border-primary/30 bg-primary/5"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{fullName(c.prenom, c.nom)}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{c.created_at?.slice(0, 16)}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                  {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                  {c.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telephone}</span>}
                  {c.mode_de_contact && <span>Préfère : {c.mode_de_contact}</span>}
                </div>
                {c.message && <p className="text-sm text-foreground mt-2 whitespace-pre-wrap break-words">{c.message}</p>}
                <div className="mt-2">
                  {c.traite ? (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                      disabled={busy === c.id} onClick={() => markContact(c.id, false)}>
                      Remettre à traiter
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      disabled={busy === c.id} onClick={() => markContact(c.id, true)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marquer traité
                    </Button>
                  )}
                </div>
              </div>
            );

            return (
              <>
                {untreated.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Aucune demande à traiter.</p>
                ) : (
                  untreated.map(renderContact)
                )}

                {treated.length > 0 && (
                  <div className="pt-2">
                    <button
                      className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-left"
                      onClick={() => setShowTreated((v) => !v)}
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="text-sm text-foreground">Traités</span>
                      <Badge variant="secondary" className="text-xs">{treated.length}</Badge>
                      <ChevronRight className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${showTreated ? "rotate-90" : ""}`} />
                    </button>
                    {showTreated && <div className="space-y-2 mt-2">{treated.map(renderContact)}</div>}
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
