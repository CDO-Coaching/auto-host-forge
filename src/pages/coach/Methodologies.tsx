import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, BookOpen, X, FileText, Dumbbell, Heart, Zap, Brain, RotateCcw, Sparkles } from "lucide-react";
import { MethodologyAIChat } from "@/components/MethodologyAIChat";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// ── Rendu markdown simple (titres, listes, tableaux, gras) ───────────────────
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Tableau markdown
    if (line.startsWith("|") && i + 1 < lines.length && lines[i + 1]?.startsWith("|---")) {
      const headers = line.split("|").filter(Boolean).map(h => h.trim());
      i += 2; // saute la ligne de séparation
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i].split("|").filter(Boolean).map(c => c.trim()));
        i++;
      }
      elements.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted">
                {headers.map((h, j) => <th key={j} className="border border-border px-2 py-1.5 text-left font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/30"}>
                  {row.map((cell, ci) => <td key={ci} className="border border-border px-2 py-1.5">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Titre ##
    if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="font-semibold text-sm mt-4 mb-1.5 text-foreground">{line.slice(3)}</h3>);
    } else if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="font-bold text-base mt-3 mb-2">{line.slice(2)}</h2>);
    }
    // Liste
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="text-sm text-foreground/85 ml-3 list-disc list-inside"
          dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }}
        />
      );
    }
    // Ligne vide
    else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    }
    // Texte normal
    else if (line.trim()) {
      elements.push(
        <p key={i} className="text-sm text-foreground/85 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }}
        />
      );
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// ── Catégories ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "force",       label: "Force",         icon: Dumbbell, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "cardio",      label: "Cardio",         icon: Heart,    color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "endurance",   label: "Endurance",      icon: RotateCcw,color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "explosivite", label: "Explosivité",    icon: Zap,      color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "mental",      label: "Mental",         icon: Brain,    color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "autre",       label: "Autre",          icon: FileText, color: "bg-muted text-muted-foreground border-border" },
] as const;

type Category = typeof CATEGORIES[number]["value"];

interface Doc {
  id: string;
  title: string;
  content: string;
  category: Category;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function Methodologies() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<Category | "all">("all");
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<Category>("autre");
  const [formTags, setFormTags] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadDocs(); }, []);

  const loadDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("coach_resource_docs" as any)
      .select("*")
      .eq("coach_id", user?.id)
      .order("updated_at", { ascending: false });
    if (!error && data) setDocs(data as Doc[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setFormTitle(""); setFormContent(""); setFormCategory("autre"); setFormTags("");
    setShowDialog(true);
  };

  const openEdit = (doc: Doc) => {
    setEditing(doc);
    setFormTitle(doc.title);
    setFormContent(doc.content);
    setFormCategory(doc.category);
    setFormTags(doc.tags?.join(", ") || "");
    setShowDialog(true);
    setSelectedDoc(null);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) { toast.error("Le titre est requis"); return; }
    setSaving(true);
    const tags = formTags.split(",").map(t => t.trim()).filter(Boolean);
    const payload = {
      coach_id: user?.id,
      title: formTitle.trim(),
      content: formContent.trim(),
      category: formCategory,
      tags,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase.from("coach_resource_docs" as any).update(payload).eq("id", editing.id);
      if (error) { toast.error("Erreur lors de la mise à jour"); }
      else { toast.success("Document mis à jour"); setShowDialog(false); loadDocs(); }
    } else {
      const { error } = await supabase.from("coach_resource_docs" as any).insert({ ...payload, created_at: new Date().toISOString() });
      if (error) { toast.error("Erreur lors de la création"); }
      else { toast.success("Document créé"); setShowDialog(false); loadDocs(); }
    }
    setSaving(false);
  };

  const handleDelete = async (doc: Doc) => {
    if (!confirm(`Supprimer "${doc.title}" ?`)) return;
    await supabase.from("coach_resource_docs" as any).delete().eq("id", doc.id);
    toast.success("Document supprimé");
    setSelectedDoc(null);
    loadDocs();
  };

  // ── Filtrage ────────────────────────────────────────────────────────────────

  const filtered = docs.filter(d => {
    const matchCat = filterCat === "all" || d.category === filterCat;
    const q = search.toLowerCase();
    const matchSearch = !q || d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q) || d.tags?.some(t => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  const catDef = (cat: Category) => CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Bibliothèque de méthodes</h1>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAIChat(true)}>
              <Sparkles className="h-4 w-4 mr-1" />
              IA
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Nouveau
            </Button>
          </div>
        </div>

        {/* Barre de recherche + filtre */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={filterCat} onValueChange={v => setFilterCat(v as any)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">
              {docs.length === 0 ? "Aucun document pour l'instant." : "Aucun résultat."}
            </p>
            {docs.length === 0 && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Créer mon premier document
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(doc => {
              const cat = catDef(doc.category);
              const Icon = cat.icon;
              return (
                <Card
                  key={doc.id}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => setSelectedDoc(doc)}
                >
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold leading-tight line-clamp-2">
                        {doc.title}
                      </CardTitle>
                      <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 ${cat.color}`}>
                        <Icon className="h-3 w-3 mr-1" />
                        {cat.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
                      {doc.content || "Aucun contenu"}
                    </p>
                    {doc.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {doc.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            #{tag}
                          </span>
                        ))}
                        {doc.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{doc.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog lecture */}
      {selectedDoc && (
        <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 pr-6">
                <DialogTitle className="text-left leading-tight">{selectedDoc.title}</DialogTitle>
                <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 ${catDef(selectedDoc.category).color}`}>
                  {catDef(selectedDoc.category).label}
                </Badge>
              </div>
            </DialogHeader>
            <div className="space-y-4">
              {/* Contenu */}
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                {selectedDoc.content
                  ? <MarkdownContent content={selectedDoc.content} />
                  : <span className="text-muted-foreground italic text-sm">Aucun contenu</span>}
              </div>
              {/* Tags */}
              {selectedDoc.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedDoc.tags.map(tag => (
                    <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">#{tag}</span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Modifié le {new Date(selectedDoc.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => openEdit(selectedDoc)} className="flex-1">
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Modifier
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(selectedDoc)} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Sheet chat IA */}
      <Sheet open={showAIChat} onOpenChange={setShowAIChat}>
        <SheetContent side="right" className="w-full sm:w-[480px] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Créer une fiche avec l'IA
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <MethodologyAIChat
              onDocumentGenerated={async (doc) => {
                const tags = doc.tags || [];
                const { error } = await supabase
                  .from("coach_resource_docs" as any)
                  .insert({
                    coach_id: user?.id,
                    title: doc.title,
                    content: doc.content,
                    category: doc.category,
                    tags,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                if (error) {
                  toast.error("Erreur lors de l'enregistrement");
                } else {
                  toast.success("Fiche enregistrée dans la bibliothèque !");
                  setShowAIChat(false);
                  loadDocs();
                }
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog création / édition */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le document" : "Nouveau document"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Ex: Méthode 5/3/1, Pyramide inversée..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={formCategory} onValueChange={v => setFormCategory(v as Category)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contenu / Notes</Label>
              <Textarea
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                placeholder="Décris la méthode, comment elle fonctionne, quand l'utiliser..."
                rows={10}
                className="resize-none font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tags <span className="text-muted-foreground font-normal">(séparés par des virgules)</span></Label>
              <Input
                value={formTags}
                onChange={e => setFormTags(e.target.value)}
                placeholder="Ex: débutant, périodisation, volume"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : editing ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
