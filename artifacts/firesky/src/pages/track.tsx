import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { CheckCircle, Circle, Loader2, AlertTriangle, Flame, Package } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STAGE_ORDER = ["enquiry", "inspection", "quoting", "quoted", "won"];

const STAGE_DESC: Record<string, string> = {
  enquiry: "Your enquiry has been received and our team is reviewing it.",
  inspection: "We are arranging a site inspection to assess your requirements.",
  quoting: "Our team is preparing a custom quote based on your site requirements.",
  quoted: "Your quote is ready. Our team will contact you to discuss the details.",
  won: "Your installation has been confirmed. Our team will be in touch to finalise scheduling.",
};

const LOAD_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Pending",     color: "text-gray-500",  bg: "bg-gray-100" },
  scheduled:  { label: "Scheduled",  color: "text-blue-600",  bg: "bg-blue-50" },
  in_transit: { label: "In Transit", color: "text-amber-600", bg: "bg-amber-50" },
  delivered:  { label: "Delivered",  color: "text-green-600", bg: "bg-green-50" },
};

interface TimelineStep {
  stage: string;
  label: string;
  done: boolean;
  current: boolean;
}

interface LoadItem {
  id: number;
  loadNumber: number;
  status: string;
  scheduledDate?: string;
  deliveredAt?: string;
  tankSize?: string;
  tankQuantity?: number;
}

interface TrackData {
  jobTitle: string;
  customerName: string;
  stage: string;
  stageLabel: string;
  tankSize?: string;
  tankQuantity?: number;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineStep[];
  loads: LoadItem[];
  isClosed: boolean;
}

export default function TrackPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/api/track/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("not_found");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("We could not find your job progress. Please check the link in your email."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link not found</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const currentStepDesc = STAGE_DESC[data.stage];
  const updatedDate = new Date(data.updatedAt).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hasLoads = data.loads && data.loads.length > 0;
  const deliveredCount = data.loads?.filter(l => l.status === "delivered").length ?? 0;
  const allDelivered = hasLoads && deliveredCount === data.loads.length;

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header */}
      <div className="bg-orange-600 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="bg-white/20 rounded-lg p-2">
            <Flame className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">Firesky Industries</p>
            <p className="text-orange-200 text-xs">Job progress tracker</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Job card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Hi {data.customerName},</p>
          <h1 className="text-xl font-bold text-gray-900 mb-1">{data.jobTitle}</h1>
          {(data.tankQuantity || data.tankSize) && (
            <p className="text-sm text-gray-500">
              {data.tankQuantity || 1}x {data.tankSize || "tank"}
            </p>
          )}
        </div>

        {/* Current status */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">Current status</p>
          <p className="text-lg font-bold text-gray-900">{data.stageLabel}</p>
          {currentStepDesc && (
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">{currentStepDesc}</p>
          )}
          <p className="text-xs text-gray-400 mt-3">Last updated: {updatedDate}</p>
        </div>

        {/* Pipeline Timeline */}
        {!data.isClosed && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Progress</p>
            <div className="space-y-0">
              {data.timeline.map((step, i) => {
                const isLast = i === data.timeline.length - 1;
                return (
                  <div key={step.stage} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                        step.done
                          ? "bg-orange-500 border-orange-500"
                          : "bg-white border-gray-200"
                      }`}>
                        {step.done ? (
                          <CheckCircle className="h-4 w-4 text-white" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-gray-300" />
                        )}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 flex-1 my-1 ${step.done ? "bg-orange-300" : "bg-gray-100"}`} style={{ minHeight: "24px" }} />
                      )}
                    </div>
                    <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
                      <p className={`text-sm font-medium ${step.current ? "text-orange-600" : step.done ? "text-gray-800" : "text-gray-400"}`}>
                        {step.label}
                        {step.current && (
                          <span className="ml-2 inline-block bg-orange-100 text-orange-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                            now
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delivery Loads — shown if loads have been added */}
        {hasLoads && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-500" />
                <p className="text-sm font-semibold text-gray-700">Delivery Loads</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                allDelivered ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
              }`}>
                {deliveredCount}/{data.loads.length} delivered
              </span>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-100 mb-4">
              {data.loads.map((load) => (
                <div
                  key={load.id}
                  className={`flex-1 transition-colors ${
                    load.status === "delivered" ? "bg-green-500" :
                    load.status === "in_transit" ? "bg-amber-400" :
                    load.status === "scheduled"  ? "bg-blue-400"  : "bg-gray-200"
                  }`}
                />
              ))}
            </div>

            <div className="space-y-2">
              {data.loads.map((load) => {
                const s = LOAD_STATUS_LABELS[load.status] ?? LOAD_STATUS_LABELS.pending;
                return (
                  <div key={load.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-sm shrink-0">
                      {load.loadNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Load {load.loadNumber}</p>
                      {(load.tankQuantity || load.tankSize) && (
                        <p className="text-xs text-gray-500">
                          {load.tankQuantity ? `${load.tankQuantity}x ` : ""}{load.tankSize || ""}
                        </p>
                      )}
                      {load.status === "delivered" && load.deliveredAt && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Delivered {format(new Date(load.deliveredAt), "d MMM yyyy")}
                        </p>
                      )}
                      {load.status === "scheduled" && load.scheduledDate && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          Scheduled {format(new Date(load.scheduledDate), "d MMM yyyy")}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Closed banner */}
        {data.isClosed && (
          <div className="bg-gray-100 rounded-xl p-5 text-center">
            <p className="font-semibold text-gray-700">This job has been closed.</p>
            <p className="text-sm text-gray-500 mt-1">
              For any questions, contact us at{" "}
              <a href="mailto:info@fireskyindustries.co.za" className="text-orange-600 font-medium">
                info@fireskyindustries.co.za
              </a>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2 pb-6">
          <p className="text-xs text-gray-400">
            Firesky Industries &nbsp;·&nbsp;{" "}
            <a href="mailto:info@fireskyindustries.co.za" className="text-orange-500">
              info@fireskyindustries.co.za
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
