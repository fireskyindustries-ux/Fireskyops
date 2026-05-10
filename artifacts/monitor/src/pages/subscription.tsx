import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, Check, Droplets, Zap, Building2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface SubData {
  subscription: {
    tier: string;
    maxTanks: number;
    priceZar: string;
    status: string;
    nextBillingDate: string | null;
  } | null;
  tanksUsed: number;
}

const PLANS = [
  {
    key: "basic",
    name: "Basic",
    price: "R99",
    period: "/month",
    tanks: 1,
    icon: Droplets,
    features: ["Monitor 1 tank", "Real-time level alerts", "Email notifications", "24h reading history"],
    color: "border-[hsl(24_10%_22%)]",
    ctaColor: "border border-[hsl(24_10%_22%)] text-[hsl(24_8%_65%)] hover:border-orange-500/40 hover:text-orange-400",
  },
  {
    key: "pro",
    name: "Pro",
    price: "R249",
    period: "/month",
    tanks: 5,
    icon: Zap,
    features: ["Monitor up to 5 tanks", "Real-time level alerts", "SMS & email notifications", "30-day history & analytics", "Priority support"],
    color: "border-orange-500/40 bg-orange-500/5",
    ctaColor: "bg-orange-500 hover:bg-orange-400 text-white",
    badge: "Most popular",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "R799",
    period: "/month",
    tanks: 25,
    icon: Building2,
    features: ["Monitor up to 25 tanks", "All Pro features", "Multi-site management", "API access", "Dedicated support"],
    color: "border-[hsl(24_10%_22%)]",
    ctaColor: "border border-[hsl(24_10%_22%)] text-[hsl(24_8%_65%)] hover:border-orange-500/40 hover:text-orange-400",
  },
];

export default function Subscription() {
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<SubData>("/subscription").then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const currentTier = data?.subscription?.tier ?? null;

  return (
    <div className="min-h-screen bg-[hsl(20_14%_7%)]">
      <header className="border-b border-[hsl(24_10%_14%)] bg-[hsl(20_12%_9%)] sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard">
            <button className="p-1.5 rounded-full text-[hsl(24_8%_55%)] hover:text-white hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="font-semibold text-white">Subscription</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Current status */}
        {!loading && data && (
          <div className="bg-[hsl(20_12%_10%)] border border-[hsl(24_10%_16%)] rounded-2xl p-5 mb-8">
            <h2 className="text-sm font-medium text-[hsl(24_8%_55%)] mb-3">Current plan</h2>
            {data.subscription ? (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-white font-semibold capitalize">{data.subscription.tier}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full border capitalize"
                    style={{ borderColor: data.subscription.status === "active" ? "#22c55e40" : "#ef444440",
                             color: data.subscription.status === "active" ? "#22c55e" : "#ef4444" }}>
                    {data.subscription.status}
                  </span>
                </div>
                <div className="text-sm text-[hsl(24_8%_45%)]">
                  {data.tanksUsed} / {data.subscription.maxTanks} tanks used
                </div>
              </div>
            ) : (
              <p className="text-sm text-[hsl(24_8%_45%)]">
                No active subscription.{" "}
                {data.tanksUsed > 0 ? `You have ${data.tanksUsed} tank${data.tanksUsed > 1 ? "s" : ""} registered.` : ""}
              </p>
            )}
          </div>
        )}

        <h2 className="text-lg font-bold text-white mb-5">Choose a plan</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentTier === plan.key;
            return (
              <div key={plan.key} className={`relative bg-[hsl(20_12%_10%)] border ${plan.color} rounded-2xl p-5 flex flex-col`}>
                {plan.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-0.5 rounded-full bg-orange-500 text-white">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-orange-500" />
                  <span className="font-semibold text-white text-sm">{plan.name}</span>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-white">{plan.price}</span>
                  <span className="text-xs text-[hsl(24_8%_45%)]">{plan.period}</span>
                </div>
                <ul className="space-y-1.5 mb-5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-[hsl(24_8%_65%)]">
                      <Check className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={isCurrent}
                  className={`w-full py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-60 ${plan.ctaColor}`}
                  onClick={() => {
                    if (!isCurrent) {
                      alert("PayFast integration coming soon — contact info@fireskyindustries.co.za to upgrade.");
                    }
                  }}
                >
                  {isCurrent ? "Current plan" : "Choose plan"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-[hsl(24_8%_35%)]">
          Plans auto-renew monthly. Cancel anytime.{" "}
          <a href="mailto:info@fireskyindustries.co.za" className="text-orange-500 hover:underline">Contact us</a> for annual pricing.
        </p>
      </main>
    </div>
  );
}
