import { useState } from "react";
import { useLocation, Link } from "wouter";
import { ChevronLeft, ScanLine, CheckCircle2 } from "lucide-react";
import { apiFetch, Tank } from "@/lib/api";

export default function RegisterTank() {
  const [, navigate] = useLocation();
  const [serial, setSerial] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Tank | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serial.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const tank = await apiFetch<Tank>("/tanks/register", {
        method: "POST",
        body: JSON.stringify({ serialNumber: serial.trim(), name: name.trim() || undefined }),
      });
      setSuccess(tank);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[hsl(20_14%_7%)] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Tank registered</h2>
          <p className="text-sm text-[hsl(24_8%_55%)] mb-6">
            <span className="font-mono text-orange-400">{success.serialNumber}</span> is now linked to your account.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/tanks/${success.id}`)}
              className="px-5 py-2.5 rounded-full bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors"
            >
              View tank
            </button>
            <button
              onClick={() => { setSuccess(null); setSerial(""); setName(""); }}
              className="px-5 py-2.5 rounded-full border border-[hsl(24_10%_22%)] text-[hsl(24_8%_55%)] text-sm hover:text-white transition-colors"
            >
              Add another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(20_14%_7%)]">
      <header className="border-b border-[hsl(24_10%_14%)] bg-[hsl(20_12%_9%)] sticky top-0 z-20">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard">
            <button className="p-1.5 rounded-full text-[hsl(24_8%_55%)] hover:text-white hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="font-semibold text-white">Register a Tank</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-[hsl(20_12%_10%)] border border-[hsl(24_10%_16%)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="font-medium text-white">Link your sensor</h2>
              <p className="text-xs text-[hsl(24_8%_45%)]">Enter the serial number printed on your Firesky unit</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-[hsl(24_8%_55%)] block mb-1.5">Serial number *</label>
              <input
                value={serial}
                onChange={e => setSerial(e.target.value.toUpperCase())}
                placeholder="e.g. FS-00123"
                required
                className="w-full bg-[hsl(20_14%_8%)] border border-[hsl(24_10%_20%)] rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder:text-[hsl(24_8%_30%)] focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-[hsl(24_8%_55%)] block mb-1.5">Give it a name (optional)</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. House tank, Barn tank..."
                className="w-full bg-[hsl(20_14%_8%)] border border-[hsl(24_10%_20%)] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-[hsl(24_8%_30%)] focus:outline-none focus:border-orange-500/50"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !serial.trim()}
              className="w-full py-3 rounded-full bg-orange-500 hover:bg-orange-400 text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Registering..." : "Register tank"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[hsl(24_8%_35%)] mt-5">
          The serial number is printed on a sticker on the sensor unit lid.<br />
          Contact <a href="mailto:info@fireskyindustries.co.za" className="text-orange-500 hover:underline">Firesky Industries</a> if you need help.
        </p>
      </main>
    </div>
  );
}
