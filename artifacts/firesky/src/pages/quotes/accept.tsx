import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { CheckCircle2, XCircle, FileText, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuoteData {
  id: number;
  quoteToken: string;
  fileUrl: string;
  status: "sent" | "accepted" | "rejected";
  notes: string | null;
  sentAt: string;
  respondedAt: string | null;
  customerName: string | null;
  enquiryId: number | null;
  jobId: number | null;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function QuoteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${BASE}/api/quote/${token}`)
      .then(async r => {
        const text = await r.text();
        try {
          const j = JSON.parse(text);
          if (!r.ok) throw new Error(j.error || "Quote not found");
          return j;
        } catch {
          throw new Error("Quote not found");
        }
      })
      .then(setQuote)
      .catch(e => setError(e.message || "Failed to load quote"))
      .finally(() => setLoading(false));
  }, [token]);

  const respond = async (action: "accept" | "reject") => {
    if (!token) return;
    setResponding(true);
    try {
      const body = action === "reject" ? { reason: rejectReason } : {};
      const res = await fetch(`${BASE}/api/quote/${token}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Failed");
      }
      setDone(action === "accept" ? "accepted" : "rejected");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your quote...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Quote not found</h2>
            <p className="text-sm text-gray-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done === "accepted") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-10 pb-10 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-green-700">Quote Accepted</h2>
            <p className="text-sm text-gray-600 mb-6">
              Thank you! Our team has been notified and will be in touch with you shortly to confirm the next steps.
            </p>
            <div className="text-xs text-gray-400">Firesky Industries — info@fireskyindustries.co.za</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done === "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-10 pb-10 text-center">
            <XCircle className="h-14 w-14 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-gray-700">Quote Declined</h2>
            <p className="text-sm text-gray-600 mb-6">
              We have noted your response. Our team may follow up with you to discuss your requirements further.
            </p>
            <div className="text-xs text-gray-400">Firesky Industries — info@fireskyindustries.co.za</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alreadyResponded = quote?.status === "accepted" || quote?.status === "rejected";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-orange-500 text-white px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-lg font-bold tracking-tight">Firesky Industries</p>
          <p className="text-sm text-orange-100">Your Custom Quote</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {quote?.customerName ? `Hi ${quote.customerName},` : "Your quote is ready"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Please review your Firesky Industries quote and let us know if you would like to proceed.
          </p>
        </div>

        {/* Quote document */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-500" />
              Quote Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={quote?.fileUrl ? `${BASE}/api/storage${quote.fileUrl}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">View Quote PDF</p>
                  <p className="text-xs text-gray-500">Click to open in a new tab</p>
                </div>
              </div>
              <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded">Open</span>
            </a>
            {quote?.notes && (
              <div className="mt-3 text-sm text-gray-600 bg-gray-50 border rounded-lg p-3 border-l-4 border-l-orange-400">
                <span className="font-medium text-gray-700">Note from our team: </span>
                {quote.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response section */}
        {alreadyResponded ? (
          <Card className={quote?.status === "accepted" ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}>
            <CardContent className="pt-6 pb-6 text-center">
              {quote?.status === "accepted" ? (
                <>
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-green-700">You accepted this quote</p>
                  <p className="text-xs text-gray-500 mt-1">Our team will be in touch shortly.</p>
                </>
              ) : (
                <>
                  <XCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <p className="font-semibold text-gray-700">You declined this quote</p>
                  <p className="text-xs text-gray-500 mt-1">We may follow up to discuss further.</p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Your Response
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Once you accept, our team will be notified and will contact you to confirm installation scheduling.
              </p>

              {!showRejectForm ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                    onClick={() => respond("accept")}
                    disabled={responding}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    {responding ? "Processing..." : "Accept Quote"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-gray-300 text-gray-600 hover:text-gray-800"
                    onClick={() => setShowRejectForm(true)}
                    disabled={responding}
                  >
                    <ThumbsDown className="h-4 w-4" />
                    Decline Quote
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Reason for declining (optional)
                    </label>
                    <Textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="e.g. Price too high, going with another supplier..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white gap-2"
                      onClick={() => respond("reject")}
                      disabled={responding}
                    >
                      <XCircle className="h-4 w-4" />
                      {responding ? "Processing..." : "Confirm Decline"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectForm(false)}
                      disabled={responding}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-4">
          Firesky Industries &nbsp;|&nbsp; info@fireskyindustries.co.za
        </div>
      </div>
    </div>
  );
}
