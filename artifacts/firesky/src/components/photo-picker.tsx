import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_PX = 1200;
const JPEG_QUALITY = 0.72;

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const ratio = Math.min(MAX_PX / img.naturalWidth, MAX_PX / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * ratio);
      const h = Math.round(img.naturalHeight * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("load failed")); };
    img.src = blobUrl;
  });
}

interface PhotoPickerProps {
  photos: (string | null)[];
  onChange: (photos: (string | null)[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

export function PhotoPicker({ photos, onChange, maxPhotos = 4, disabled = false }: PhotoPickerProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFileChange = async (index: number, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      const next = [...photos];
      next[index] = dataUrl;
      onChange(next);
    } catch {
      // ignore
    }
  };

  const handleRemove = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const next = [...photos];
    next[index] = null;
    onChange(next);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: maxPhotos }).map((_, i) => {
        const photo = photos[i] ?? null;
        return (
          <div key={i} className="relative aspect-[4/3]">
            <input
              ref={(el) => { inputRefs.current[i] = el; }}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={disabled}
              onChange={(e) => handleFileChange(i, e.target.files?.[0] ?? null)}
              onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
            />
            {photo ? (
              <div className="relative h-full rounded-lg overflow-hidden border shadow-sm">
                <img
                  src={photo}
                  alt={`Site photo ${i + 1}`}
                  className="h-full w-full object-cover cursor-pointer"
                  onClick={() => !disabled && inputRefs.current[i]?.click()}
                />
                {!disabled && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full opacity-90 shadow"
                    onClick={(e) => handleRemove(e, i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRefs.current[i]?.click()}
                className={cn(
                  "h-full w-full rounded-lg border-2 border-dashed border-muted-foreground/30",
                  "flex flex-col items-center justify-center gap-2",
                  "bg-muted/20 hover:bg-muted/40 active:bg-muted/60 transition-colors",
                  "text-muted-foreground",
                  disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
              >
                <Camera className="h-7 w-7" />
                <span className="text-xs font-medium">Photo {i + 1}</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
