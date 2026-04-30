import { useState, useEffect, useRef, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Plus, MoreVertical, Pencil, Trash, Menu, X, Search, BrainCircuit, CalendarDays } from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConversations, useCreateConversation, useDeleteConversation, useUpdateConversation } from "@/hooks/use-conversations";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MemoryPanel } from "./memory-panel";

function CalendarNavButton() {
  const [, navigate] = useLocation();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-xs h-8"
      onClick={() => navigate("/calendar")}
    >
      <CalendarDays className="w-3.5 h-3.5" />
      My Diary
    </Button>
  );
}

interface SidebarProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  isMobile?: boolean;
}

export function Sidebar({ activeId, onSelect, isMobile = false }: SidebarProps) {
  const { data: conversations, isLoading } = useConversations();
  const createConv = useCreateConversation();
  const deleteConv = useDeleteConversation();
  const updateConv = useUpdateConversation();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [memoryOpen, setMemoryOpen] = useState(false);

  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; id: string; title: string }>({
    isOpen: false,
    id: "",
    title: "",
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations ?? [];
    const q = search.toLowerCase();
    return (conversations ?? []).filter((c) => c.title?.toLowerCase().includes(q));
  }, [conversations, search]);

  const handleNew = async () => {
    try {
      const conv = await createConv.mutateAsync(undefined);
      onSelect(conv.id);
    } catch (e) {
      toast({ title: "Failed to create conversation", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConv.mutateAsync(id);
      if (activeId === id) {
        onSelect(""); // Clear selection
      }
    } catch (e) {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleRename = async () => {
    if (!renameDialog.title.trim()) return;
    try {
      await updateConv.mutateAsync({ id: renameDialog.id, title: renameDialog.title });
      setRenameDialog({ isOpen: false, id: "", title: "" });
    } catch (e) {
      toast({ title: "Failed to rename", variant: "destructive" });
    }
  };

  const content = (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border w-[280px]">
      <div className="p-3 flex items-center gap-2">
        <Button onClick={handleNew} className="flex-1 justify-start gap-2 h-9" variant="outline">
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => window.close()}
          title="Close Sky Vision"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-muted/50 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 pb-4">
          {isLoading ? (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              {search ? "No matching chats" : "No conversations"}
            </div>
          ) : (
            filtered.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer transition-colors ${
                  activeId === conv.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
                onClick={() => onSelect(conv.id)}
              >
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate font-medium">{conv.title || "New Conversation"}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 touch:opacity-100 [@media(hover:none)]:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameDialog({ isOpen: true, id: conv.id, title: conv.title || "New Conversation" });
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(conv.id);
                      }}
                    >
                      <Trash className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Memory + Calendar buttons */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <CalendarNavButton />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-xs h-8"
          onClick={() => setMemoryOpen(true)}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          Sky's Memory
        </Button>
      </div>

      <Dialog open={renameDialog.isOpen} onOpenChange={(open) => setRenameDialog(p => ({ ...p, isOpen: open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={renameDialog.title}
            onChange={(e) => setRenameDialog(p => ({ ...p, title: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(p => ({ ...p, isOpen: false }))}>Cancel</Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemoryPanel open={memoryOpen} onOpenChange={setMemoryOpen} />
    </div>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[280px] bg-sidebar border-r-sidebar-border border-r">
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return <div className="hidden md:block h-full">{content}</div>;
}
