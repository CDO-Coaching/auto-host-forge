import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Video, Camera, Send, X, Loader2, Upload, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMessages } from "@/hooks/useMessages";

interface SendVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachId: string | null;
  coachName: string;
  exerciseName?: string;
}

export function SendVideoDialog({ 
  open, 
  onOpenChange, 
  coachId, 
  coachName,
  exerciseName 
}: SendVideoDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { sendMessage } = useMessages();

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const startProgressSimulation = () => {
    setUploadProgress(0);
    let progress = 0;
    
    progressIntervalRef.current = setInterval(() => {
      // Simulate progress that slows down as it approaches 90%
      const increment = Math.max(1, (90 - progress) / 10);
      progress = Math.min(90, progress + increment);
      setUploadProgress(Math.round(progress));
    }, 200);
  };

  const completeProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setUploadProgress(100);
    setTimeout(() => setUploadProgress(0), 500);
  };

  const resetProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setUploadProgress(0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mov', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('video/') && !file.type.startsWith('image/')) {
      toast({
        title: "Format non supporté",
        description: "Veuillez sélectionner une vidéo ou une image",
        variant: "destructive",
      });
      return;
    }

    // Vérifier la taille (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 100 Mo",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    
    // Créer une prévisualisation
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleRemoveFile = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!coachId) {
      toast({
        title: "Erreur",
        description: "Impossible de trouver votre coach",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile && !message.trim()) {
      toast({
        title: "Message vide",
        description: "Ajoutez une vidéo ou un message",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    
    // Start progress simulation if there's a file to upload
    if (selectedFile) {
      startProgressSimulation();
    }
    
    try {
      const messageContent = message.trim() || 
        (exerciseName ? `📹 Vidéo de l'exercice : ${exerciseName}` : "📹 Vidéo de ma technique");
      
      await sendMessage(coachId, messageContent, selectedFile || undefined);
      
      completeProgress();
      
      toast({
        title: "Envoyé !",
        description: `Ton ${selectedFile?.type.startsWith('video/') ? 'vidéo' : 'fichier'} a été envoyé à ${coachName}`,
      });

      // Reset et fermer
      handleRemoveFile();
      setMessage("");
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur envoi:", error);
      resetProgress();
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) {
      handleRemoveFile();
      setMessage("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-600" />
            Envoyer à {coachName}
          </DialogTitle>
          <DialogDescription>
            {exerciseName 
              ? `Envoie ta vidéo de "${exerciseName}" pour que ${coachName} puisse voir ta technique.`
              : `Envoie une vidéo ou un message à ${coachName}.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Inputs cachés pour sélection de fichier */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleFileSelect}
            onClick={(e) => {
              // Force reset pour permettre la re-sélection
              (e.target as HTMLInputElement).value = '';
            }}
            className="hidden"
          />

          {!selectedFile ? (
            <div className="space-y-3">
              {/* Bouton filmer avec la caméra */}
              <Button
                variant="default"
                className="w-full h-16 flex flex-col gap-1"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Video className="h-6 w-6" />
                <span className="text-sm">Filmer avec la caméra</span>
              </Button>
              
              {/* Bouton sélectionner depuis la galerie */}
              <Button
                variant="outline"
                className="w-full h-14 flex items-center gap-3"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-5 w-5" />
                <span>Choisir depuis la galerie</span>
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">Vidéo ou photo (max 100 Mo)</p>
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden bg-muted">
              {selectedFile.type.startsWith('video/') ? (
                <video 
                  src={preview || undefined} 
                  className="w-full max-h-48 object-contain"
                  controls
                />
              ) : (
                <img 
                  src={preview || undefined} 
                  alt="Prévisualisation"
                  className="w-full max-h-48 object-contain"
                />
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={handleRemoveFile}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} Mo
              </div>
            </div>
          )}

          {/* Message optionnel */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-sm">Message (optionnel)</Label>
            <Textarea
              id="message"
              placeholder="Ajouter un commentaire..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              disabled={isSending}
            />
          </div>

          {/* Barre de progression */}
          {isSending && selectedFile && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4 animate-pulse" />
                <span>Upload en cours... {uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleClose} 
              className="flex-1"
              disabled={isSending}
            >
              Annuler
            </Button>
            <Button 
              onClick={handleSend} 
              className="flex-1"
              disabled={isSending || (!selectedFile && !message.trim())}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
