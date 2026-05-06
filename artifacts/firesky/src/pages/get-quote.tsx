import { useState } from "react";
import { Flame, CheckCircle, Loader2 } from "lucide-react";
import { brand } from "@/brand.config";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TANK_SIZES = [
  "500L", "1000L", "2500L", "5000L", "10000L", "20000L", "25000L", "30000L", "Other",
];

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

  if (success) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
        <div className="bg-orange-600 px-4 py-5">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">{brand.name}</p>
              <p className="text-orange-200 text-xs">{brand.tagline}</p>
            </div>
          </div>
        </div>
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
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header */}
      <div className="bg-orange-600 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="bg-white/20 rounded-lg p-2">
            <Flame className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">{brand.name}</p>
            <p className="text-orange-200 text-xs">{brand.tagline}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Get a Free Quote</h1>
          <p className="text-sm text-gray-500 mb-6">
            Fill in your details and we'll get back to you with a custom quote.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
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

            {/* Phone */}
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

            {/* Email */}
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

            {/* Tank size + quantity */}
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

            {/* Location */}
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

            {/* Message */}
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

        <div className="text-center pb-6">
          <p className="text-xs text-gray-400">
            {brand.name} &nbsp;·&nbsp;{" "}
            <a href={`mailto:${brand.contact.email}`} className="text-orange-500">
              {brand.contact.email}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
