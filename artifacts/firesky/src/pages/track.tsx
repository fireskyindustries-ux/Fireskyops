import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { CheckCircle, Circle, Loader2, AlertTriangle, Flame } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STAGE_ORDER = ["enquiry", "inspection", "quoting", "quoted", "won"];

const STAGE_DESC: Record<string, string> = {
  enquiry: "Your enquiry has been received and our team is reviewing it.",
  inspection: "We are arranging a site inspection to assess your requirements.",
  quoting: "Our team is preparing a custom quote based on your site requirements.",
  quoted: "Your quote is ready. Our team will contact you to discuss the details.",
  won: "Your installation has been confirmed. Our team will be in touch to finalise scheduling.",
};

interface TimelineStep {
  stage: string;
  label: string;
  done: boolean;
  current: boolean;
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

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
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

        {/* Timeline */}
        {!data.isClosed && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">Progress</p>
            <div className="space-y-0">
              {data.timeline.map((step, i) => {
                const isLast = i === data.timeline.length - 1;
                return (
                  <div key={step.stage} className="flex gap-3">
                    {/* Icon + line */}
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

                    {/* Label */}
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
        <div className="text-center pt-2">
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
