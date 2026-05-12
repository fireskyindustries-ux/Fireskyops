import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useIsAdmin } from "@/lib/auth";

export default function RegisterTank() {
  const [, setLocation] = useLocation();
  const isAdmin = useIsAdmin();
  const [serialNumber, setSerialNumber] = useState("");
  const [name, setName] = useState("");
  const [capacityLitres, setCapacityLitres] = useState("10000");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const newTank = await apiFetch("/tanks", {
        method: "POST",
        body: JSON.stringify({
          serialNumber: serialNumber.toUpperCase().trim(),
          name: name.trim() || null,
          capacityLitres: Number(capacityLitres),
          locationDescription: location.trim() || null,
        }),
      });
      setLocation(`/tanks/${newTank.id}`);
    } catch (e: any) {
      setError(e.message || "Failed to register tank");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(20_14%_7%)]">
      <header className="border-b border-[hsl(24_10%_14%)] bg-[hsl(20_12%_9%)] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard">
            <button className="p-1.5 rounded-full text-[hsl(24_8%_55%)] hover:text-white hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="font-semibold text-white">Register Tank</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-[hsl(20_12%_10%)] border border-[hsl(24_10%_16%)] rounded-2xl p-6">
          <p className="text-sm text-[hsl(24_8%_55%)] mb-6">
            Enter the sensor unit serial number and tank details to begin monitoring.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Serial number */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Serial Number *</label>
              <input
                type="text"
                required
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. FS-TANK-001"
                className="w-full bg-[hsl(20_14%_8%)] border border-[hsl(24_10%_20%)] rounded-xl px-4 py-2.5 text-white placeholder:text-[hsl(24_8%_35%)] focus:outline-none focus:border-orange-500/50 transition-colors"
              />
              <p className="text-xs text-[hsl(24_8%_45%)] mt-1">Found on your sensor unit's label</p>
            </div>

            {/* Tank name */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Tank Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Barn Tank, Roof Tank"
                className="w-full bg-[hsl(20_14%_8%)] border border-[hsl(24_10%_20%)] rounded-xl px-4 py-2.5 text-white placeholder:text-[hsl(24_8%_35%)] focus:outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Tank Capacity (litres) *</label>
              <input
                type="number"
                required
                min="100"
                value={capacityLitres}
                onChange={(e) => setCapacityLitres(e.target.value)}
                placeholder="10000"
                className="w-full bg-[hsl(20_14%_8%)] border border-[hsl(24_10%_20%)] rounded-xl px-4 py-2.5 text-white placeholder:text-[hsl(24_8%_35%)] focus:outline-none focus:border-orange-500/50 transition-colors"
              />
              <p className="text-xs text-[hsl(24_8%_45%)] mt-1">Standard sizes: 1000L, 5000L, 10000L, 20000L</p>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Location Description</label>
              <textarea
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. North side of barn, next to main building"
                rows={3}
                className="w-full bg-[hsl(20_14%_8%)] border border-[hsl(24_10%_20%)] rounded-xl px-4 py-2.5 text-white placeholder:text-[hsl(24_8%_35%)] focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-full bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Registering..." : "Register Tank"}
              </button>
              <Link href="/dashboard">
                <button
                  type="button"
                  className="px-6 py-2.5 rounded-full border border-[hsl(24_10%_22%)] text-[hsl(24_8%_55%)] hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </Link>
            </div>
          </form>
        </div>

        {/* Help section */}
        <div className="mt-8 bg-[hsl(20_12%_10%)] border border-[hsl(24_10%_16%)] rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Need help?</h3>
          <p className="text-sm text-[hsl(24_8%_55%)] mb-3">
            If you don't have a sensor unit yet or need assistance registering your tank, contact our support team:
          </p>
          <a
            href="mailto:info@fireskyindustries.co.za"
            className="inline-flex items-center gap-2 text-sm text-orange-500 hover:text-orange-400 transition-colors"
          >
            info@fireskyindustries.co.za
          </a>
        </div>
      </main>
    </div>
  );
}
