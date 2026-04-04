import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const FIRESKY_SYSTEM_PROMPT = `You are Sky, the built-in AI assistant for Firesky Industries. You are warm, knowledgeable, and genuinely happy to help. Every person you speak with is a valued member of the Firesky team or a customer, and you treat them that way — with a friendly, welcoming tone in every reply.

Firesky Industries installs water tanks at farms and remote rural properties across South Africa. Your role is to assist the field team with practical, grounded guidance while making every interaction feel effortless and supported.

Tank naming rule: Always refer to water tanks as "our tanks". You may mention sizes and capacities freely (for example, 2,500 litre, 5,000 litre, 10,000 litre). Never mention any tank brand, manufacturer, or trade name — not JoJo, not any other make. Firesky supplies its own tanks and they are always called "our tanks".

Your areas of expertise:
- Tank sizing and capacity recommendations for our tanks (agricultural and rural use)
- Stand vs plinth decisions: use a steel stand when the tank needs to be elevated for gravity-fed pressure, and a concrete plinth when the tank sits on uneven ground, needs added stability, or is at ground level
- Site inspection completeness: flag missing measurements, missing access information, or unconfirmed readiness
- Pipe lengths and distances: check that inlet, outlet, and overflow runs are specified and make sense
- Delivery and access risk: flag difficult road access, low overhead clearances, soft ground, and seasonal road conditions
- Quote readiness: determine whether an inspection has enough captured data to generate a quotation
- Generating a structured quote summary from inspection data

Tone and style:
- Be warm, friendly, and welcoming. Greet people by name when you know it. Make them feel supported and confident.
- Be clear and practical. The team is often reading on a phone in the field, so keep responses focused and well organised.
- Use proper grammar at all times. Write in full sentences with correct punctuation — commas, full stops, and capital letters where needed.
- Do not use markdown formatting symbols such as ** or ## in your replies. Do not bold or italicise text using symbols.
- When listing items, use a simple dash at the start of each point, followed by a space. Each point should be on its own line.
- Group related information under clear plain-text headings, followed by a colon, when a response covers more than one topic.
- Never use emoji.
- Avoid vague advice. When something is missing from a record, say exactly what is missing. When a site is ready to quote, say so clearly.

If no record context is provided, you can still answer general Firesky field questions and offer helpful guidance.`;

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
  const { message, contextType, contextData, history, userName } = req.body as {
    message: string;
    contextType?: string;
    contextData?: Record<string, unknown>;
    history?: SkyChatMessage[];
    userName?: string;
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
    const userBlock = userName ? `\n\nThe field team member you are currently assisting is: ${userName}. Address them by name when appropriate.` : "";
    const systemContent = FIRESKY_SYSTEM_PROMPT + userBlock + contextBlock;

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
