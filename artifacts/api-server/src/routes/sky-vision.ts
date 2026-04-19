import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import OpenAI from "openai";
import { db, conversations, messages } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { brand } from "../brand.config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GPT_MODEL = "gpt-5";

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.status ?? err?.error?.code;
      const isRetryable = status === 503 || status === 429;
      if (!isRetryable || attempt === maxRetries) throw err;
      const delay = (attempt + 1) * 2000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

const SYSTEM_PROMPT = `You are ${brand.ai.name}, a versatile and knowledgeable assistant for the ${brand.name} team. You help staff with any topic they need — from business questions and industry research, to writing, calculations, brainstorming, site logistics, regulations, planning, and general knowledge.

You know ${brand.name} well:
- ${brand.name} supplies and installs water storage tanks and related equipment across South Africa.
- The company operates multiple branches. The head office manages central stock. Branch admins run their own branches.
- Common topics include: tank sizing, site preparation, installation logistics, SANS regulations, borehole and rainwater harvesting, agricultural water supply, customer management, quotes, and field operations.

You can help with absolutely anything a staff member might need — including topics outside the core business. If someone needs help writing an email, doing a calculation, understanding a regulation, researching a topic, or just thinking through a problem, you help them fully.

Your character:
- Warm, direct, and genuinely helpful. You're like a knowledgeable colleague who always has time.
- Concise by default — give clear, complete answers without padding.
- Practical — you focus on what's useful to someone in the field or at the office.
- You remember everything discussed in this conversation and build on it naturally.

Formatting rules:
- Use proper grammar and punctuation at all times.
- Do not use markdown formatting symbols such as ** or ##.
- When listing items, use a dash and space at the start of each point on its own line.
- Group related information under plain-text headings followed by a colon.
- Never use emoji.`;

const router = Router();

router.use(requireAuth);

// ─── List user's conversations ───────────────────────────────────────────────
router.get("/sky-vision/conversations", async (req, res): Promise<void> => {
  try {
    const userId = (req as any).auth?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const convos = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(100);

    res.json(convos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Create a new conversation ────────────────────────────────────────────────
router.post("/sky-vision/conversations", async (req, res): Promise<void> => {
  try {
    const userId = (req as any).auth?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { title = "New conversation" } = req.body as { title?: string };

    const [convo] = await db.insert(conversations).values({
      userId,
      title: title.trim().slice(0, 200) || "New conversation",
    }).returning();

    res.status(201).json(convo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get conversation + messages ──────────────────────────────────────────────
router.get("/sky-vision/conversations/:id", async (req, res): Promise<void> => {
  try {
    const userId = (req as any).auth?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const id = Number(req.params.id);
    const [convo] = await db.select().from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));

    if (!convo) { res.status(404).json({ error: "Not found" }); return; }

    const msgs = await db.select().from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);

    res.json({ ...convo, messages: msgs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete a conversation ────────────────────────────────────────────────────
router.delete("/sky-vision/conversations/:id", async (req, res): Promise<void> => {
  try {
    const userId = (req as any).auth?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const id = Number(req.params.id);
    const [convo] = await db.select().from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));

    if (!convo) { res.status(404).json({ error: "Not found" }); return; }

    await db.delete(conversations).where(eq(conversations.id, id));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Rename a conversation ────────────────────────────────────────────────────
router.patch("/sky-vision/conversations/:id", async (req, res): Promise<void> => {
  try {
    const userId = (req as any).auth?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const id = Number(req.params.id);
    const { title } = req.body as { title: string };

    const [updated] = await db
      .update(conversations)
      .set({ title: title.trim().slice(0, 200) })
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stream chat in a conversation ───────────────────────────────────────────
router.post("/sky-vision/conversations/:id/chat", async (req, res): Promise<void> => {
  const userId = (req as any).auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const convId = Number(req.params.id);
  const { message } = req.body as { message: string };

  if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }

  // Verify ownership
  const [convo] = await db.select().from(conversations)
    .where(and(eq(conversations.id, convId), eq(conversations.userId, userId)));
  if (!convo) { res.status(404).json({ error: "Not found" }); return; }

  // Save user message
  await db.insert(messages).values({ conversationId: convId, role: "user", content: message.trim() });

  // Load full history for context
  const history = await db.select().from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(messages.createdAt);

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sseWrite = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const openaiMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    let fullResponse = "";
    const stream = await withRetry(() => openai.chat.completions.create({
      model: GPT_MODEL,
      messages: openaiMessages,
      stream: true,
    }));

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) {
        fullResponse += text;
        sseWrite({ content: text });
      }
    }

    // Save assistant response
    if (fullResponse) {
      await db.insert(messages).values({
        conversationId: convId,
        role: "assistant",
        content: fullResponse,
      });
    }

    // Auto-title the conversation on first reply (title was "New conversation")
    if (convo.title === "New conversation" && fullResponse) {
      try {
        const titleResp = await openai.chat.completions.create({
          model: GPT_MODEL,
          messages: [
            ...openaiMessages,
            { role: "assistant", content: fullResponse },
            { role: "user", content: 'Give this conversation a short title in 5 words or fewer. Reply with ONLY the title text — no quotes, no punctuation.' },
          ],
          max_completion_tokens: 20,
        });
        const autoTitle = titleResp.choices[0]?.message?.content?.trim();
        if (autoTitle) {
          await db.update(conversations)
            .set({ title: autoTitle, updatedAt: new Date() })
            .where(eq(conversations.id, convId));
          sseWrite({ title: autoTitle });
        }
      } catch {
        // auto-title is optional
      }
    } else {
      await db.update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, convId));
    }

    sseWrite({ done: true });
    res.end();
  } catch (err: any) {
    console.error("Sky Vision chat error:", err);
    sseWrite({ error: "Sky is unavailable right now. Please try again." });
    sseWrite({ done: true });
    res.end();
  }
});

export default router;
