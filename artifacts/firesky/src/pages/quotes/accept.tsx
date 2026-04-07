import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { CheckCircle2, XCircle, FileText, Clock, ThumbsUp, ThumbsDown, Upload, Receipt } from "lucide-react";
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
  paymentProofUrl: string | null;
  customerName: string | null;
  enquiryId: number | null;
  jobId: number | null;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function PageHeader() {
  return (
    <div className="bg-orange-500 text-white px-4 py-5">
      <div className="max-w-2xl mx-auto">
        <p className="text-lg font-bold tracking-tight">Firesky Industries</p>
        <p className="text-sm text-orange-100">Your Custom Quote</p>
      </div>
    </div>
  );
}

function PaymentProofSection({ token, alreadyUploaded }: { token: string; alreadyUploaded: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(alreadyUploaded);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      // Step 1: Request presigned URL
      const urlRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedFile.name,
          size: selectedFile.size,
          contentType: selectedFile.type || "application/pdf",
        }),
      });
      if (!urlRes.ok) throw new Error("Could not prepare upload");
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: Upload file to storage
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type || "application/pdf" },
      });
      if (!uploadRes.ok) throw new Error("File upload failed");

      // Step 3: Save proof of payment reference
      const proofRes = await fetch(`${BASE}/api/quote/${token}/payment-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: objectPath }),
      });
      if (!proofRes.ok) {
        const j = await proofRes.json();
        throw new Error(j.error || "Failed to save proof");
      }

      setUploaded(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (uploaded) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Proof of payment received</p>
              <p className="text-xs text-green-700 mt-0.5">Our team has been notified and will confirm your payment.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-orange-500" />
          Proof of Payment
          <span className="text-xs font-normal text-gray-400 ml-1">(optional)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          You can upload your proof of payment here so our team can verify and confirm your order without delay. This step is optional — you can also email it to us directly.
        </p>
        <div
          className="border-2 border-dashed border-gray-200 rounded-lg p-5 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-6 w-6 mx-auto mb-2 text-gray-400" />
          {selectedFile ? (
            <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
          ) : (
            <>
              <p className="text-sm text-gray-500">Click to select a file</p>
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, or PNG accepted</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf,image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button
          className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white"
          onClick={handleUpload}
          disabled={uploading || !selectedFile}
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : "Submit Proof of Payment"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function QuoteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [justAccepted, setJustAccepted] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [declined, setDeclined] = useState(false);

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
      if (action === "accept") {
        setJustAccepted(true);
        setQuote(q => q ? { ...q, status: "accepted" } : q);
      } else {
        setDeclined(true);
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setResponding(false);
    }
  };

  // ── Loading state ──
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

  // ── Error state ──
  if (error && !quote) {
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

  // ── Declined state ──
  if (declined) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader />
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <Card>
            <CardContent className="pt-10 pb-10 text-center">
              <XCircle className="h-14 w-14 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-gray-700">Quote Declined</h2>
              <p className="text-sm text-gray-600">
                We have noted your response. Our team may follow up with you to discuss your requirements further.
              </p>
            </CardContent>
          </Card>
          <div className="text-center text-xs text-gray-400">Firesky Industries &nbsp;|&nbsp; info@fireskyindustries.co.za</div>
        </div>
      </div>
    );
  }

  const isAccepted = quote?.status === "accepted" || justAccepted;
  const isRejected = quote?.status === "rejected" && !justAccepted;
  const isPending = quote?.status === "sent" && !justAccepted;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader />

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {quote?.customerName ? `Hi ${quote.customerName},` : "Your quote is ready"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAccepted
              ? "Your quote has been accepted. Thank you for choosing Firesky Industries."
              : isRejected
              ? "You have declined this quote."
              : "Please review your Firesky Industries quote and let us know if you would like to proceed."}
          </p>
        </div>

        {/* Accepted banner */}
        {isAccepted && justAccepted && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Quote accepted</p>
              <p className="text-xs text-green-700">Our team has been notified and will be in touch shortly.</p>
            </div>
          </div>
        )}

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

        {/* Response section — only shown while pending */}
        {isPending && (
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
                    <Button variant="outline" onClick={() => setShowRejectForm(false)} disabled={responding}>
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Already declined (returning to page) */}
        {isRejected && (
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="pt-6 pb-6 text-center">
              <XCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">You declined this quote</p>
              <p className="text-xs text-gray-500 mt-1">We may follow up to discuss further.</p>
            </CardContent>
          </Card>
        )}

        {/* Proof of payment — shown when accepted */}
        {isAccepted && token && (
          <PaymentProofSection
            token={token}
            alreadyUploaded={!!quote?.paymentProofUrl}
          />
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-4">
          Firesky Industries &nbsp;|&nbsp; info@fireskyindustries.co.za
        </div>
      </div>
    </div>
  );
}
