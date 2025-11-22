import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

export default function Questions() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      toast.error("Veuillez saisir une question");
      return;
    }

    setLoading(true);
    setResponse("");

    try {
      const webhookUrl = "https://n8n-i4coc8gkwgok0s4k0gsscsgw.168.231.84.252.sslip.io/webhook/de8949b6-93c2-49b1-b75c-427b3a84a724";
      
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!res.ok) {
        throw new Error("Erreur lors de l'envoi de la question");
      }

      const data = await res.json();
      setResponse(data.output || JSON.stringify(data, null, 2));
      toast.success("Réponse reçue !");
      setQuestion("");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Impossible d'obtenir une réponse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Questions</h1>
        <p className="text-muted-foreground mt-2">
          Posez vos questions et obtenez des réponses basées sur la recherche scientifique
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Poser une question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="Ex: Quels sont les bénéfices de l'entraînement en haute intensité ?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[120px]"
              disabled={loading}
            />
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recherche en cours...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Envoyer
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle>Réponse</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">
                {response}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
