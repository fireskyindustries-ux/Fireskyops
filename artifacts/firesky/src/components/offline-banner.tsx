import { useOnline } from "@/hooks/use-online";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-600 text-white text-sm font-medium py-2 px-4 shadow-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>No internet — inspections will be saved and synced when signal returns.</span>
    </div>
  );
}
