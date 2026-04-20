import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, BookMarked } from "lucide-react";

interface SavedPrompt {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

interface PromptLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentInput?: string;
  onSelect: (content: string) => void;
}

export function PromptLibrary({ open, onOpenChange, currentInput = "", onSelect }: PromptLibraryProps) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState(currentInput);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/sky-vision/prompts", { credentials: "include" });
      const data = await res.json();
      setPrompts(Array.isArray(data) ? data : []);
    } catch {
      setPrompts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchPrompts();
    setShowNew(false);
    setNewTitle("");
    setNewContent(currentInput);
  }, [open, currentInput, fetchPrompts]);

  const handleSave = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setIsSaving(true);
    try {
      await fetch("/api/sky-vision/prompts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, content: newContent }),
      });
      toast({ title: "Prompt saved" });
      setShowNew(false);
      setNewTitle("");
      setNewContent("");
      fetchPrompts();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/sky-vision/prompts/${id}`, { method: "DELETE", credentials: "include" });
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleSelect = (content: string) => {
    onSelect(content);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Prompt Library</DialogTitle>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setShowNew(true); setNewContent(currentInput || ""); }}>
              <Plus className="w-3.5 h-3.5" />
              Save prompt
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Click a prompt to load it into the input.</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
          {showNew && (
            <div className="border border-primary/40 rounded-xl p-3 space-y-2 bg-primary/5">
              <Input
                placeholder="Prompt title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-sm"
                autoFocus
              />
              <Textarea
                placeholder="Prompt content..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="min-h-[80px] resize-none text-sm"
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={!newTitle.trim() || !newContent.trim() || isSaving}>
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : prompts.length === 0 && !showNew ? (
            <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
              <BookMarked className="w-8 h-8 opacity-40" />
              <p className="text-sm text-center">No saved prompts yet. Type something in the chat and save it here to reuse it anytime.</p>
            </div>
          ) : (
            prompts.map((prompt) => (
              <div
                key={prompt.id}
                className="group flex items-start gap-2 border border-border rounded-xl p-3 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-colors"
                onClick={() => handleSelect(prompt.content)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{prompt.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{prompt.content}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleDelete(prompt.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
