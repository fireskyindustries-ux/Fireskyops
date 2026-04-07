import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Mail, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface EmailLogEntry {
  id: number;
  to: string;
  subject: string;
  type: "quote" | "job_stage" | "other";
  status: "sent" | "failed";
  relatedType: string | null;
  relatedId: number | null;
  resendId: string | null;
  error: string | null;
  sentAt: string;
  customerName: string | null;
}

const typeLabel: Record<string, string> = {
  quote: "Quote",
  job_stage: "Job update",
  other: "Other",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export default function EmailLogPage() {
  const [limit, setLimit] = useState(50);

  const { data, isLoading, refetch, isFetching } = useQuery<EmailLogEntry[]>({
    queryKey: ["email-logs", limit],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/email-logs?limit=${limit}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load email log");
      return res.json();
    },
  });

  const sent = data?.filter(e => e.status === "sent").length ?? 0;
  const failed = data?.filter(e => e.status === "failed").length ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All emails sent to customers from this system</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-green-800">{sent}</p>
                  <p className="text-xs text-green-700">Sent successfully</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(failed > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50")}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <XCircle className={cn("h-6 w-6 shrink-0", failed > 0 ? "text-red-500" : "text-gray-400")} />
                <div>
                  <p className={cn("text-2xl font-bold", failed > 0 ? "text-red-800" : "text-gray-600")}>{failed}</p>
                  <p className={cn("text-xs", failed > 0 ? "text-red-700" : "text-gray-500")}>Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Log table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Recent emails
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : !data?.length ? (
            <div className="p-8 text-center">
              <Mail className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No emails have been sent yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {data.map(entry => (
                <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {entry.status === "sent"
                      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : <XCircle className="h-4 w-4 text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{entry.subject}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {typeLabel[entry.type] ?? entry.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      To: <span className="font-medium text-foreground">{entry.customerName ? `${entry.customerName} (${entry.to})` : entry.to}</span>
                    </p>
                    {entry.status === "failed" && entry.error && (
                      <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">
                        Error: {entry.error}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 text-right">
                    {formatDate(entry.sentAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {data && data.length >= limit && (
            <div className="p-4 border-t text-center">
              <Button variant="outline" size="sm" onClick={() => setLimit(l => l + 50)}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
