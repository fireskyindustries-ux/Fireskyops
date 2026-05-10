import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import OpenAI from "openai";
import { db, tanksTable, tankReadingsTable } from "@workspace/db";
import { requirePortalAuth, getPortalUser } from "../middlewares/requirePortalAuth";
import { logger } from "../lib/logger";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status ?? err?.error?.code;
      if ((status !== 503 && status !== 429) || attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
    }
  }
  throw lastErr;
}

function offlineStatus(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return true;
  return Date.now() - new Date(lastSeenAt).getTime() > 2 * 60 * 60 * 1000;
}

router.post("/sky/chat", requirePortalAuth, async (req, res): Promise<void> => {
  const user = getPortalUser(req);
  const { message, history = [] } = req.body as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sseWrite = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // Fetch all tanks for this portal user with their latest readings
    const tanks = await db
      .select()
      .from(tanksTable)
      .where(eq(tanksTable.portalUserId, user.id));

    const tanksWithReadings = await Promise.all(
      tanks.map(async (tank) => {
        const latest = await db
          .select()
          .from(tankReadingsTable)
          .where(eq(tankReadingsTable.tankId, tank.id))
          .orderBy(desc(tankReadingsTable.recordedAt))
          .limit(1);
        return { ...tank, latestReading: latest[0] ?? null };
      }),
    );

    const tankLines = tanksWithReadings.map((t) => {
      const r = t.latestReading;
      const isOffline = offlineStatus(t.lastSeenAt);
      const levelStr = r
        ? `${Number(r.levelPercent).toFixed(1)}% full (${Number(r.litres).toFixed(0)}L of ${t.capacityLitres}L capacity)`
        : "no readings yet";
      const battStr = r?.batteryPercent != null ? `, battery: ${r.batteryPercent}%` : "";
      const locStr = t.locationDescription ? `, location: ${t.locationDescription}` : "";
      const alertStr = `alert threshold: ${t.alertThresholdPercent}%`;
      const statusStr = isOffline ? "⚠️ OFFLINE" : "online";
      const belowAlert =
        r && Number(r.levelPercent) < t.alertThresholdPercent ? " ⚠️ BELOW ALERT THRESHOLD" : "";
      return `• ${t.name ?? t.serialNumber} (serial: ${t.serialNumber}) — ${levelStr}${battStr}${locStr}, ${alertStr}, status: ${statusStr}${belowAlert}`;
    });

    const tanksContext =
      tankLines.length > 0
        ? tankLines.join("\n")
        : "No tanks registered yet. The customer can register a tank using the serial number on their device.";

    const today = new Date().toLocaleDateString("en-ZA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const systemPrompt = `You are Sky, a friendly AI assistant built into the Firesky Industries Tank Monitor app. You are helping ${user.name} manage and understand their water storage.

LIVE TANK DATA (as of right now):
${tanksContext}

Today is ${today}.

Your role:
- Help the customer understand their current tank levels, usage trends, and alerts
- Explain what readings mean in plain language (e.g. "Your barn tank is at 35% — that's about 3,500 litres, roughly 2–3 weeks of typical farm use")
- Proactively flag if any tanks are critically low or offline
- Help them troubleshoot sensor issues (if a tank has been offline >2h, the device may have lost power or connectivity)
- Help them decide when to top up based on their usage
- If they want to register a new tank, tell them to tap "Register a Tank" on their dashboard
- For billing or plan upgrades, tell them to visit the Subscription page or contact info@fireskyindustries.co.za
- For hardware support or technical issues, direct them to info@fireskyindustries.co.za

Keep responses concise and mobile-friendly. Use plain language, no jargon. Speak directly to ${user.name}. Do not invent data — only use what is shown above.`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message.trim() },
    ];

    const stream = await withRetry(() =>
      openai.chat.completions.create({
        model: "gpt-5",
        messages,
        max_completion_tokens: 1024,
        stream: true,
      }),
    );

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) sseWrite({ content: text });
    }

    sseWrite({ done: true });
    res.end();
  } catch (err: any) {
    logger.error({ err, portalUserId: user.id }, "Portal Sky chat error");
    sseWrite({ error: "Sky is unavailable right now. Please try again." });
    sseWrite({ done: true });
    res.end();
  }
});

export default router;
