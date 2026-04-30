import { useState, useEffect } from "react";
import { Sparkles, X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSkyActions } from "./SkyContext";
import { useUser } from "@clerk/react";

const SPLASH_KEY = "sky-splash-shown";

export function SkySplash() {
  const { user, isLoaded } = useUser();
  const { openSky } = useSkyActions();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const role = (user?.publicMetadata?.role as string) || "guest";
  const firstName = user?.firstName;

  // Show for non-admin authenticated users, once per session
  const shouldShow = isLoaded && user && role !== "admin" && role !== "branch_admin";

  useEffect(() => {
    if (!shouldShow) return;
    const alreadySeen = sessionStorage.getItem(SPLASH_KEY);
    if (alreadySeen) return;

    // Small delay so the page settles before the splash appears
    const t = setTimeout(() => {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
    }, 800);
    return () => clearTimeout(t);
  }, [shouldShow]);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(SPLASH_KEY, "1");
    setTimeout(() => setMounted(false), 300);
  };

  const chat = () => {
    dismiss();
    setTimeout(() => openSky(), 320);
  };

  if (!mounted) return null;

  return (
    <div
      className={`
        fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[88px] md:pb-8
        transition-all duration-300 ease-out
        ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}
      `}
    >
      <div className="w-full max-w-sm rounded-2xl bg-sidebar border border-sidebar-border shadow-xl shadow-black/10 overflow-hidden">
        {/* Header strip */}
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary leading-tight">Sky</p>
            <p className="text-[10px] text-primary/70">Your Firesky assistant</p>
          </div>
          <button
            onClick={dismiss}
            className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          <p className="text-sm leading-relaxed text-foreground">
            {firstName ? `Hi ${firstName}! ` : "Hi there! "}
            I'm Sky — I can help you find the right water storage solution, answer questions about tanks and installation, or guide you through our process.
          </p>

          <div className="flex gap-2">
            <Button
              onClick={chat}
              className="flex-1 h-10 gap-2 text-sm font-medium"
            >
              <MessageCircle className="h-4 w-4" />
              Chat with Sky
            </Button>
            <Button
              variant="ghost"
              onClick={dismiss}
              className="h-10 px-4 text-sm text-muted-foreground"
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
