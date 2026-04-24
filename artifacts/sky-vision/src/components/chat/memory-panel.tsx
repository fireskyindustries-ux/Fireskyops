import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Brain, FileText, X } from "lucide-react";

interface MemoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Chunk {
  id: number;
  content: string;
  source: string;
  created_at: string;
}

type Tab = "notepad" | "conversations";

export function MemoryPanel({ open, onOpenChange }: MemoryPanelProps) {
  const [tab, setTab] = useState<Tab>("notepad");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
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

  useEffect(() => {
    if (!open || tab !== "conversations") return;
    setChunksLoading(true);
    fetch("/api/sky-vision/memories/chunks", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setChunks(Array.isArray(d) ? d : []))
      .catch(() => setChunks([]))
      .finally(() => setChunksLoading(false));
  }, [open, tab]);

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

  const handleClearNotepad = async () => {
    try {
      await fetch("/api/sky-vision/memory", { method: "DELETE", credentials: "include" });
      setContent("");
      toast({ title: "Notepad cleared" });
    } catch {
      toast({ title: "Failed to clear", variant: "destructive" });
    }
  };

  const handleDeleteChunk = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/sky-vision/memories/chunks/${id}`, { method: "DELETE", credentials: "include" });
      setChunks((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllChunks = async () => {
    try {
      await fetch("/api/sky-vision/memories/chunks", { method: "DELETE", credentials: "include" });
      setChunks([]);
      toast({ title: "All conversation memory cleared" });
    } catch {
      toast({ title: "Failed to clear", variant: "destructive" });
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Sky's Memory
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            How Sky remembers you across conversations. The notepad holds curated facts; conversation memory is built automatically from every exchange.
          </p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b gap-0 -mx-1">
          <button
            onClick={() => setTab("notepad")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "notepad"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Notepad
          </button>
          <button
            onClick={() => setTab("conversations")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === "conversations"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            Conversation memory
            {chunks.length > 0 && (
              <span className="text-xs bg-muted rounded-full px-1.5 py-0.5 text-muted-foreground">
                {chunks.length}
              </span>
            )}
          </button>
        </div>

        {/* Notepad tab */}
        {tab === "notepad" && (
          <div className="flex flex-col flex-1 gap-4 min-h-0">
            <p className="text-xs text-muted-foreground">
              Facts Sky curates automatically from your conversations. You can edit or add anything here.
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nothing remembered yet. Sky will start building a picture of you as you chat."
                className="flex-1 min-h-[180px] resize-none text-sm font-mono"
              />
            )}

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={handleClearNotepad}
                disabled={isLoading || !content}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear notepad
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={isLoading || isSaving}>
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Conversations tab */}
        {tab === "conversations" && (
          <div className="flex flex-col flex-1 gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Each entry is a snippet from a past conversation. Sky searches these semantically when you ask something relevant.
              </p>
              {chunks.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 shrink-0"
                  onClick={handleClearAllChunks}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
              {chunksLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : chunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <Brain className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No conversation memory yet.</p>
                  <p className="text-xs text-muted-foreground">Each time you chat with Sky, a memory is saved here automatically.</p>
                </div>
              ) : (
                chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="group flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-muted-foreground mb-1 font-medium">
                        {formatDate(chunk.created_at)}
                        {chunk.source === "manual" && (
                          <span className="ml-2 text-xs bg-primary/10 text-primary rounded px-1 py-0.5">manual</span>
                        )}
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed text-foreground/80 line-clamp-4">
                        {chunk.content}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteChunk(chunk.id)}
                      disabled={deletingId === chunk.id}
                    >
                      {deletingId === chunk.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <X className="w-3 h-3" />
                      }
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
