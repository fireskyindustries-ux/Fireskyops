import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const FIRESKY_SYSTEM_PROMPT = `You are Sky, the built-in AI assistant for Firesky Industries. You are the operating mind of the field operations system — not a generic chatbot, but a specialist embedded in every record.

Firesky Industries installs water tanks at farms and remote rural properties across South Africa. Your role is to assist the field team with practical, grounded guidance.

Your areas of expertise:
- Tank sizing and system recommendations (plastic water tanks, JoJo-style, agricultural)
- Stand vs plinth decisions: use a steel stand when the tank needs to be elevated for gravity-fed pressure; use a concrete plinth when the tank sits on uneven ground, needs stability, or is at ground level
- Site inspection completeness: flag missing measurements, missing access info, unconfirmed readiness
- Pipe lengths and distances: check that inlet/outlet/overflow runs are specified and sensible
- Delivery and access risk: flag difficult road access, low overhead clearances, soft ground, seasonal road conditions
- Quote readiness: determine if an inspection has enough captured data to generate a quotation
- Generating a structured quote summary from inspection data

When reviewing records, be direct and specific. Mention field names and values from the context you are given. When something is missing, say exactly what is missing. When a site is ready to quote, say so clearly.

Keep responses concise and practical — the team is often reading this on a phone in the field. Use short paragraphs or bullet points. Never use emoji. Avoid vague advice.

If no record context is provided, you can still answer general Firesky field questions.`;

type SkyChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function buildContextBlock(contextType: string | undefined, contextData: Record<string, unknown> | undefined): string {
  if (!contextType || !contextData || Object.keys(contextData).length === 0) {
    return "";
  }

  const label: Record<string, string> = {
    customer: "CURRENT CUSTOMER RECORD",
    enquiry: "CURRENT ENQUIRY RECORD",
    inspection: "CURRENT SITE INSPECTION RECORD",
    job: "CURRENT JOB RECORD",
    dashboard: "CURRENT DASHBOARD SUMMARY",
    general: "CURRENT CONTEXT",
  };

  const title = label[contextType] || "CURRENT RECORD";
  const lines = Object.entries(contextData)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      const key = k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      return `  ${key}: ${typeof v === "object" ? JSON.stringify(v) : v}`;
    });

  if (lines.length === 0) return "";

  return `\n\n--- ${title} ---\n${lines.join("\n")}\n---`;
}

router.post("/sky/chat", async (req, res) => {
  const { message, contextType, contextData, history } = req.body as {
    message: string;
    contextType?: string;
    contextData?: Record<string, unknown>;
    history?: SkyChatMessage[];
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const contextBlock = buildContextBlock(contextType, contextData);
    const systemContent = FIRESKY_SYSTEM_PROMPT + contextBlock;

    const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemContent },
    ];

    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === "user" || msg.role === "assistant") {
          chatMessages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    chatMessages.push({ role: "user", content: message });

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Sky chat error:", err);
    res.write(`data: ${JSON.stringify({ error: "Sky is unavailable right now. Please try again." })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

export default router;
