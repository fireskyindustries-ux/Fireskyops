import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";

interface MemoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemoryPanel({ open, onOpenChange }: MemoryPanelProps) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    fetch("/api/sky-vision/memory", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setContent(d.content || ""))
      .catch(() => setContent(""))
      .finally(() => setIsLoading(false));
  }, [open]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/sky-vision/memory", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      toast({ title: "Memory updated" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      await fetch("/api/sky-vision/memory", { method: "DELETE", credentials: "include" });
      setContent("");
      toast({ title: "Memory cleared" });
    } catch {
      toast({ title: "Failed to clear", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sky's Memory</DialogTitle>
          <p className="text-sm text-muted-foreground">
            These are the facts Sky remembers about you across all conversations. You can edit or clear them at any time.
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nothing remembered yet. Sky will start building a picture of you as you chat."
            className="min-h-[200px] resize-none text-sm font-mono"
          />
        )}

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
            onClick={handleClear}
            disabled={isLoading || !content}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear memory
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={isLoading || isSaving}>
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
