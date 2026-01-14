import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface MediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  type: 'video' | 'image';
}

export function MediaPreviewDialog({ open, onOpenChange, url, type }: MediaPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 sm:p-4">
        <div className="flex items-center justify-center w-full h-full">
          {type === 'video' ? (
            <video
              src={url}
              controls
              autoPlay
              className="max-w-full max-h-[85vh] rounded-lg"
            />
          ) : (
            <img
              src={url}
              alt="Image en plein écran"
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
