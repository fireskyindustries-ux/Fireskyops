import { useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, MessageCircle, X, Send } from "lucide-react";
import { brand } from "@/brand.config";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TANK_SIZES = [
  "500L", "1000L", "2500L", "5000L", "10000L", "20000L", "25000L", "30000L", "Other",
];

/* ─── Sky mini-chat ──────────────────────────────────────────────────────── */

type ChatMsg = { role: "user" | "assistant"; content: string };

function SkyChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content: `Hi! I'm ${brand.ai.name}. Not sure which tank size you need, or have questions about installation? Ask me anything.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const history: ChatMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(history);
    setStreaming(true);
    setMsgs((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const resp = await fetch(`${BASE}/api/sky/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history.slice(0, -1),
          userRole: "guest",
        }),
      });

      if (!resp.body) throw new Error("No stream");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;
            try {
              const parsed = JSON.parse(payload);
              const chunk =
                parsed.choices?.[0]?.delta?.content ??
                parsed.delta?.text ?? "";
              if (chunk) {
                setMsgs((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: updated[updated.length - 1].content + chunk,
                  };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch {
      setMsgs((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I couldn't connect. Please try again.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-full px-4 py-3 shadow-lg transition-colors"
      >
        {open ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        <span className="text-sm">Ask {brand.ai.name}</span>
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-80 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ maxHeight: "60dvh" }}>
          {/* Header */}
          <div className="bg-orange-600 px-4 py-3 flex items-center gap-2">
            <img
              src={`${BASE}/${brand.logoFile}`}
              alt={brand.name}
              className="h-6 w-auto object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div>
              <p className="text-white font-bold text-sm leading-tight">{brand.ai.name}</p>
              <p className="text-orange-200 text-[10px]">Your water storage guide</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-orange-600 text-white rounded-br-sm"
                    : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm"
                }`}>
                  {m.content || (streaming && i === msgs.length - 1 ? (
                    <span className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  ) : "")}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t border-gray-100 bg-white flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Type a question..."
              disabled={streaming}
              className="flex-1 text-sm border border-gray-200 rounded-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-full p-2 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function GetQuotePage() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    tankSize: "",
    tankQuantity: "",
    location: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${BASE}/api/public-enquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          tankSize: form.tankSize,
          tankQuantity: form.tankQuantity ? Number(form.tankQuantity) : undefined,
          location: form.location,
          message: form.message,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const header = (subtitle: string) => (
    <div className="bg-orange-600 px-4 py-4">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <img
          src={`${BASE}/${brand.logoFile}`}
          alt={brand.name}
          className="h-10 w-auto object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <div>
          <p className="text-white font-bold text-base leading-tight">{brand.name}</p>
          <p className="text-orange-200 text-xs">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  if (success) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
        {header("Free Quote Request")}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <CheckCircle className="h-14 w-14 text-orange-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Quote request received!</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Thanks {form.name.split(" ")[0]}! Our team will review your request and get back to you shortly.
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Questions?{" "}
              <a href={`mailto:${brand.contact.email}`} className="text-orange-500 font-medium">
                {brand.contact.email}
              </a>
            </p>
          </div>
        </div>
        <SkyChat />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      {header("Free Quote Request")}

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Get a Free Quote</h1>
          <p className="text-sm text-gray-500 mb-6">
            Fill in your details and we'll get back to you with a custom quote.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Full Name <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="John Smith"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="082 000 0000"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="john@example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-gray-50"
              />
            </div>

            <p className="text-xs text-gray-400 -mt-2">Please provide at least a phone number or email.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Tank Size
                </label>
                <select
                  value={form.tankSize}
                  onChange={(e) => set("tankSize", e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-gray-50"
                >
                  <option value="">Select size</option>
                  {TANK_SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={form.tankQuantity}
                  onChange={(e) => set("tankQuantity", e.target.value)}
                  placeholder="1"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-gray-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Town / Area
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="e.g. Bloemfontein, Free State"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Anything else we should know?
              </label>
              <textarea
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                placeholder="e.g. farm location, borehole water, access details..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-gray-50 resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold rounded-full py-3.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Request Free Quote"
              )}
            </button>
          </form>
        </div>

        <div className="text-center pb-2">
          <p className="text-xs text-gray-400">
            {brand.name} &nbsp;·&nbsp;{" "}
            <a href={`mailto:${brand.contact.email}`} className="text-orange-500">
              {brand.contact.email}
            </a>
          </p>
        </div>
      </div>

      <SkyChat />
    </div>
  );
}
