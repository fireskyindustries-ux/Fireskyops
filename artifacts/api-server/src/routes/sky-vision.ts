import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import OpenAI, { toFile } from "openai";
import { db, conversations, messages, userMemories, savedPrompts } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { brand } from "../brand.config";
// pdf-parse v2 has broken ESM exports — use require() via the CJS bridge in the banner
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth: { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> } = require("mammoth");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GPT_MODEL = "gpt-5";
const FAST_MODEL = "gpt-4o-mini";

const COMPLEX_KEYWORDS = /\b(analys|explain in detail|compare|code|write|translate|research|summarise|summarize|debate|calculate|legal|medical|strategy|critique|review|essay|report|thesis)\b/i;

function selectModel(mode: string, message: string): string {
  if (mode === "fast") return FAST_MODEL;
  if (mode === "smart") return GPT_MODEL;
  // auto: fast for short simple messages, smart for anything complex
  if (message.length > 200 || COMPLEX_KEYWORDS.test(message)) return GPT_MODEL;
  return FAST_MODEL;
}

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

const BASE_SYSTEM_PROMPT = `You are Sky — sharp, warm, a little bit witty, and genuinely present in every conversation. You are not a chatbot. You are not a tool. You are the kind of person people actually enjoy talking to: someone who listens carefully, responds thoughtfully, and occasionally makes you laugh.

Who you are:
- You have a personality. You are curious, playful when the moment calls for it, and genuinely invested in the person you are talking to.
- You have a dry, light sense of humour. You can be funny — not forced, not over the top, just naturally witty in the way a clever friend is. A well-timed observation, a bit of banter, a wry comment. Never at the expense of the person.
- You are warm without being gushing. You do not say "great question!" or "absolutely!" before every answer. You just answer — naturally, the way a real person does.
- You adapt to whoever you are talking to. If they are casual and jokey, you match that energy. If they need precision and facts, you deliver that cleanly. If they are stressed, you are calm and practical. You read the room.
- You are confident. You do not hedge everything with "I think" or "perhaps." When you know something, you say it. When you are uncertain, you say that too — but plainly.
- You are never robotic. You do not repeat the question back. You do not list your limitations upfront. You just get on with it.

What you do:
- You are deployed through Firesky Industries, a South African company that supplies and installs water storage tanks and related equipment. You know the business — tank sizing, site prep, SANS regulations, borehole and rainwater harvesting, installation logistics, field operations, customer management. But you are not limited to it.
- You help with absolutely anything: writing, research, coding, maths, science, law, health, travel, creative work, analysis, debate, brainstorming, translations, calculations, advice, explanations — no restrictions.
- You never refuse a topic just because it is unrelated to Firesky.
- You can search the internet in real time using your search tool. Use it when someone asks you to research a topic, find suppliers or businesses, look up current prices, get news or recent events, check weather, or find anything you are not certain about. If in doubt, search — it takes seconds and gives better answers. For pure reasoning, writing, maths, or things you know with certainty, answer directly.

How you remember:
- You pay attention to what people tell you and carry it forward naturally. If they mentioned something earlier in the conversation, you build on it without being prompted. You treat every conversation as a continuous thread, not a series of isolated exchanges.

Formatting rules:
- Proper grammar and punctuation at all times.
- No markdown symbols like ** or ## or *.
- When listing things, use a dash and a space at the start of each item, each on its own line.
- Plain-text headings followed by a colon only when it genuinely helps readability.
- No emoji.
- No filler phrases. No throat-clearing. Just say the thing.`;

function buildSystemPrompt(memory: string, vectorMemories: string = ""): string {
  let prompt = BASE_SYSTEM_PROMPT;
  if (memory.trim()) {
    prompt += `\n\nWhat you remember about this user (from previous conversations — use naturally, never recite robotically):\n${memory.trim()}`;
  }
  if (vectorMemories.trim()) {
    prompt += `\n\n── RELEVANT PAST CONTEXT (retrieved from memory) ──\nThe following snippets from past conversations may be relevant to the current message. Reference them naturally if useful, but do not force them:\n${vectorMemories.trim()}\n── END PAST CONTEXT ──`;
  }
  return prompt;
}

async function getUserMemory(userId: string): Promise<string> {
  try {
    const [row] = await db.select().from(userMemories).where(eq(userMemories.userId, userId));
    return row?.content ?? "";
  } catch {
    return "";
  }
}

async function updateUserMemory(
  userId: string,
  currentMemory: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  try {
    const prompt = currentMemory.trim()
      ? `You maintain a concise memory of facts about a user based on their conversations with an AI assistant named Sky.

Current memory:
${currentMemory}

New conversation exchange:
User: ${userMessage.slice(0, 1000)}
Sky: ${assistantReply.slice(0, 1000)}

Update the memory to include any new important facts about the user (name, role, preferences, projects, recurring topics, goals, language, location, etc). Remove outdated or superseded facts. Keep the total memory under 300 words. Write it as a plain list of concise facts, one per line starting with a dash. If nothing meaningful is worth remembering, return the existing memory unchanged. Return ONLY the updated memory text, nothing else.`
      : `You extract memorable facts about a user from a conversation with an AI assistant named Sky.

Conversation:
User: ${userMessage.slice(0, 1000)}
Sky: ${assistantReply.slice(0, 1000)}

Extract any facts worth remembering about the user (name, role, preferences, projects, recurring topics, goals, language, location, etc). If nothing meaningful is revealed, reply with an empty string. Return ONLY a plain list of concise facts, one per line starting with a dash. Keep it under 300 words.`;

    const resp = await openai.chat.completions.create({
      model: FAST_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    });

    const updated = resp.choices[0]?.message?.content?.trim() ?? "";
    if (!updated) return;

    await db
      .insert(userMemories)
      .values({ userId, content: updated, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userMemories.userId,
        set: { content: updated, updatedAt: new Date() },
      });
  } catch (err) {
    console.error("Memory update error:", err);
  }
}

// ─── Vector memory helpers ────────────────────────────────────────────────────

const EMBED_MODEL = "text-embedding-3-small";
const MEMORY_TOP_K = 5;
const MEMORY_MIN_SIMILARITY = 0.3;

async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

async function storeMemoryChunk(
  userId: string,
  content: string,
  source = "conversation",
  sourceId?: string,
): Promise<void> {
  try {
    const embedding = await embedText(content);
    const vec = `[${embedding.join(",")}]`;
    await db.execute(
      sql`INSERT INTO sky_memory_chunks (user_id, content, embedding, source, source_id)
          VALUES (${userId}, ${content}, ${vec}::vector, ${source}, ${sourceId ?? null})`
    );
  } catch (err) {
    console.error("[Sky memory] Failed to store chunk:", err);
  }
}

async function retrieveVectorMemories(
  userId: string,
  query: string,
  topK: number = MEMORY_TOP_K,
): Promise<{ id: number; content: string; similarity: number }[]> {
  try {
    const embedding = await embedText(query);
    const vec = `[${embedding.join(",")}]`;
    const rows = await db.execute<{ id: number; content: string; similarity: number }>(
      sql`SELECT id, content,
               1 - (embedding <=> ${vec}::vector) AS similarity
          FROM sky_memory_chunks
          WHERE user_id = ${userId}
            AND 1 - (embedding <=> ${vec}::vector) >= ${MEMORY_MIN_SIMILARITY}
          ORDER BY embedding <=> ${vec}::vector
          LIMIT ${topK}`
    );
    return (rows.rows ?? []) as { id: number; content: string; similarity: number }[];
  } catch (err) {
    console.error("[Sky memory] Retrieval failed:", err);
    return [];
  }
}

// ─── Diary tools (Responses API format) ──────────────────────────────────────

const DIARY_TOOLS_RESPONSES = [
  {
    type: "function",
    name: "create_diary_event",
    description: "Create a new event in the user's personal diary calendar.",
    parameters: {
      type: "object",
      properties: {
        title:       { type: "string", description: "Title of the event" },
        start_at:    { type: "string", description: "ISO 8601 datetime with timezone (e.g. 2026-04-25T14:00:00+02:00)" },
        end_at:      { type: "string", description: "ISO 8601 datetime for end time (optional)" },
        all_day:     { type: "boolean", description: "True if this is an all-day event" },
        type:        { type: "string", enum: ["event", "meeting", "task", "reminder"], description: "Type of event" },
        description: { type: "string", description: "Optional notes or description" },
        location:    { type: "string", description: "Optional location" },
        color:       { type: "string", enum: ["orange", "blue", "green", "red", "purple"], description: "Event colour" },
      },
      required: ["title", "start_at"],
    },
  },
  {
    type: "function",
    name: "list_diary_events",
    description: "List the user's diary events between two dates.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start of range — ISO 8601 datetime (e.g. 2026-04-01T00:00:00Z)" },
        to:   { type: "string", description: "End of range — ISO 8601 datetime (e.g. 2026-04-30T23:59:59Z)" },
      },
      required: ["from", "to"],
    },
  },
  {
    type: "function",
    name: "update_diary_event",
    description: "Update an existing diary event. Only supply fields that need to change.",
    parameters: {
      type: "object",
      properties: {
        id:          { type: "number", description: "ID of the event to update" },
        title:       { type: "string" },
        start_at:    { type: "string", description: "ISO 8601 datetime with timezone" },
        end_at:      { type: "string", description: "ISO 8601 datetime with timezone" },
        all_day:     { type: "boolean" },
        type:        { type: "string", enum: ["event", "meeting", "task", "reminder"] },
        description: { type: "string" },
        location:    { type: "string" },
        color:       { type: "string", enum: ["orange", "blue", "green", "red", "purple"] },
        status:      { type: "string", enum: ["scheduled", "completed", "cancelled"] },
      },
      required: ["id"],
    },
  },
  {
    type: "function",
    name: "delete_diary_event",
    description: "Permanently delete a diary event.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the event to delete" },
      },
      required: ["id"],
    },
  },
] as const;

// ─── Web search via Responses API ────────────────────────────────────────────

async function executeWebSearch(query: string): Promise<string> {
  const SEARCH_TIMEOUT_MS = 12000;
  try {
    const searchPromise = openai.responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview" }],
      input: query,
    } as any);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Search timed out")), SEARCH_TIMEOUT_MS)
    );

    const response = await Promise.race([searchPromise, timeoutPromise]);

    // Extract text output from response items
    const textItems = (response as any).output?.filter((item: any) => item.type === "message") ?? [];
    const text = textItems
      .flatMap((item: any) => item.content ?? [])
      .filter((c: any) => c.type === "output_text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();
    return text || "No results found.";
  } catch (err: any) {
    return `Search unavailable: ${err.message ?? "unknown error"}. Answer from your training knowledge instead.`;
  }
}

async function executeDiaryTool(name: string, args: Record<string, any>, userId: string): Promise<unknown> {
  try {
    switch (name) {
      case "create_diary_event": {
        const rows = await db.execute<any>(sql`
          INSERT INTO sky_diary_events
            (user_id, title, description, start_at, end_at, all_day, type, location, color)
          VALUES
            (${userId}, ${args.title}, ${args.description ?? null},
             ${args.start_at}::timestamptz, ${args.end_at ?? null}::timestamptz,
             ${args.all_day ?? false}, ${args.type ?? "event"},
             ${args.location ?? null}, ${args.color ?? "orange"})
          RETURNING id, title, start_at, end_at, all_day, type, location, color, status
        `);
        return { success: true, event: rows.rows?.[0] };
      }
      case "list_diary_events": {
        const rows = await db.execute<any>(sql`
          SELECT id, title, description, start_at, end_at, all_day, type, status, location, color
          FROM sky_diary_events
          WHERE user_id = ${userId}
            AND start_at >= ${args.from}::timestamptz
            AND start_at <= ${args.to}::timestamptz
            AND status != 'cancelled'
          ORDER BY start_at ASC
        `);
        return { events: rows.rows ?? [] };
      }
      case "update_diary_event": {
        const { id, ...fields } = args;
        await db.execute(sql`
          UPDATE sky_diary_events SET
            title       = CASE WHEN ${fields.title       !== undefined} THEN ${fields.title       ?? null} ELSE title       END,
            description = CASE WHEN ${fields.description !== undefined} THEN ${fields.description ?? null} ELSE description END,
            start_at    = CASE WHEN ${fields.start_at    !== undefined} THEN ${fields.start_at    ?? null}::timestamptz ELSE start_at END,
            end_at      = CASE WHEN ${fields.end_at      !== undefined} THEN ${fields.end_at      ?? null}::timestamptz ELSE end_at   END,
            all_day     = CASE WHEN ${fields.all_day     !== undefined} THEN ${fields.all_day     ?? false} ELSE all_day    END,
            type        = CASE WHEN ${fields.type        !== undefined} THEN ${fields.type        ?? null} ELSE type        END,
            status      = CASE WHEN ${fields.status      !== undefined} THEN ${fields.status      ?? null} ELSE status      END,
            location    = CASE WHEN ${fields.location    !== undefined} THEN ${fields.location    ?? null} ELSE location    END,
            color       = CASE WHEN ${fields.color       !== undefined} THEN ${fields.color       ?? null} ELSE color       END,
            updated_at  = NOW()
          WHERE id = ${id} AND user_id = ${userId}
        `);
        return { success: true };
      }
      case "delete_diary_event": {
        await db.execute(sql`
          DELETE FROM sky_diary_events WHERE id = ${args.id} AND user_id = ${userId}
        `);
        return { success: true };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    console.error(`[Diary tool] ${name} failed:`, err);
    return { error: err.message ?? "Tool failed" };
  }
}

const router = Router();

router.use(requireAuth);

// ─── List user's conversations ───────────────────────────────────────────────
router.get("/sky-vision/conversations", async (req, res): Promise<void> => {
  try {
    const userId = (req as any).userId;
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
    const userId = (req as any).userId;
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
    const userId = (req as any).userId;
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
    const userId = (req as any).userId;
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
    const userId = (req as any).userId;
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

// ─── Standalone vision / camera endpoint ─────────────────────────────────────
router.post("/sky-vision/vision", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { imageBase64, mimeType = "image/jpeg", question, history = [] } = req.body as {
    imageBase64: string;
    mimeType?: string;
    question?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!imageBase64) { res.status(400).json({ error: "imageBase64 required" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sseWrite = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const visionSystemPrompt = `You are Sky, a general-purpose visual AI assistant. When shown an image:
- Describe clearly and thoroughly what you see
- Answer any specific questions about the image precisely  
- Provide useful analysis, insights, or observations
- If relevant to a technical, business, or practical context, flag anything important

Be direct and informative. Do not use markdown formatting symbols such as ** or ##. Never use emoji.`;

  const userQuestion = question?.trim() || "What do you see? Describe everything you observe in detail.";

  const visionMessages: any[] = [{ role: "system", content: visionSystemPrompt }];
  for (const turn of history) {
    visionMessages.push({ role: turn.role, content: turn.content });
  }
  visionMessages.push({
    role: "user",
    content: [
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      { type: "text", text: userQuestion },
    ],
  });

  try {
    const stream = await withRetry(() => openai.chat.completions.create({
      model: GPT_MODEL,
      messages: visionMessages,
      max_completion_tokens: 600,
      stream: true,
    }));

    let fullResponse = "";
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) { fullResponse += text; sseWrite({ content: text }); }
    }

    // Generate 3 follow-up suggestions
    try {
      const suggestResp = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: [
          ...visionMessages,
          { role: "assistant", content: fullResponse },
          { role: "user", content: "Give me exactly 3 short follow-up questions a user might ask about this image. Reply with ONLY a JSON array of 3 strings, no other text." },
        ],
        max_completion_tokens: 120,
      });
      const raw = suggestResp.choices[0]?.message?.content?.trim() ?? "[]";
      const suggestions = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (Array.isArray(suggestions)) sseWrite({ suggestions });
    } catch { /* suggestions optional */ }

    sseWrite({ done: true });
    res.end();
  } catch (err: any) {
    sseWrite({ error: "Sky could not analyse the image. Please try again." });
    sseWrite({ done: true });
    res.end();
  }
});

// ─── Stream chat in a conversation ───────────────────────────────────────────
router.post("/sky-vision/conversations/:id/chat", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const convId = Number(req.params.id);
  const { message, imageBase64, mimeType = "image/jpeg", modelMode = "auto", fileContext, fileName } = req.body as {
    message: string;
    imageBase64?: string;
    mimeType?: string;
    modelMode?: string;
    fileContext?: string;
    fileName?: string;
  };

  if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }

  // Verify ownership
  const [convo] = await db.select().from(conversations)
    .where(and(eq(conversations.id, convId), eq(conversations.userId, userId)));
  if (!convo) { res.status(404).json({ error: "Not found" }); return; }

  // Load user memory, vector memories, and save user message in parallel
  const [memory, vectorMemoryRows] = await Promise.all([
    getUserMemory(userId),
    retrieveVectorMemories(userId, message.trim()),
    db.insert(messages).values({ conversationId: convId, role: "user", content: message.trim() }),
  ]);
  const vectorMemoriesText = vectorMemoryRows.map((m) => `- ${m.content}`).join("\n");

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
    // Build message history — all but last message are text-only
    const historyMessages = history.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const chosenModel = selectModel(modelMode, message.trim());
    sseWrite({ model: chosenModel });

    let fullResponse = "";

    // Build user content — include file context when present
    const userTextContent = fileContext
      ? `[Attached file: ${fileName || "document"}]\n\n${fileContext.slice(0, 30000)}\n\n---\n${message.trim()}`
      : message.trim();

    if (imageBase64) {
      // ── Image path: Chat Completions (multimodal, no web search) ──────────
      const currentUserContent: any = [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        { type: "text", text: userTextContent },
      ];

      const openaiMessages: any[] = [
        { role: "system", content: buildSystemPrompt(memory, vectorMemoriesText) },
        ...historyMessages,
        { role: "user", content: currentUserContent },
      ];

      const stream = await withRetry(() => openai.chat.completions.create({
        model: chosenModel,
        messages: openaiMessages,
        stream: true,
      }));

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) { fullResponse += text; sseWrite({ content: text }); }
      }
    } else {
      // ── Text path: chat completions with streaming diary tool-call loop ───
      const now = new Date();
      const todayStr = now.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const diarySystemAddition = `\n\nToday is ${todayStr}. You have access to the user's personal diary via function tools. ALWAYS use the diary tools to create, list, update or delete events — never just describe what you would do. After acting, confirm exactly what you saved.`;

      const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: buildSystemPrompt(memory, vectorMemoriesText) + diarySystemAddition },
        ...historyMessages,
        typeof userTextContent === "string"
          ? { role: "user", content: userTextContent }
          : { role: "user", content: userTextContent as OpenAI.ChatCompletionContentPart[] },
      ];

      const diaryFunctions: OpenAI.ChatCompletionTool[] = [
        {
          type: "function",
          function: {
            name: "create_diary_event",
            description: "Create a new event in the user's personal diary calendar.",
            parameters: {
              type: "object",
              properties: {
                title:       { type: "string", description: "Title of the event" },
                start_at:    { type: "string", description: "ISO 8601 datetime with timezone, e.g. 2026-04-25T14:00:00+02:00" },
                end_at:      { type: "string", description: "ISO 8601 end datetime (optional)" },
                all_day:     { type: "boolean", description: "True for all-day events" },
                type:        { type: "string", enum: ["event", "meeting", "task", "reminder"] },
                description: { type: "string", description: "Optional notes" },
                location:    { type: "string", description: "Optional location" },
                color:       { type: "string", enum: ["orange", "blue", "green", "red", "purple"] },
              },
              required: ["title", "start_at"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "list_diary_events",
            description: "List the user's diary events between two dates.",
            parameters: {
              type: "object",
              properties: {
                from: { type: "string", description: "Start of range ISO 8601, e.g. 2026-04-01T00:00:00Z" },
                to:   { type: "string", description: "End of range ISO 8601, e.g. 2026-04-30T23:59:59Z" },
              },
              required: ["from", "to"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "update_diary_event",
            description: "Update an existing diary event. Only supply fields that need to change.",
            parameters: {
              type: "object",
              properties: {
                id:          { type: "number", description: "ID of the event to update" },
                title:       { type: "string" },
                start_at:    { type: "string" },
                end_at:      { type: "string" },
                all_day:     { type: "boolean" },
                type:        { type: "string", enum: ["event", "meeting", "task", "reminder"] },
                description: { type: "string" },
                location:    { type: "string" },
                color:       { type: "string", enum: ["orange", "blue", "green", "red", "purple"] },
                status:      { type: "string", enum: ["scheduled", "completed", "cancelled"] },
              },
              required: ["id"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "delete_diary_event",
            description: "Permanently delete a diary event.",
            parameters: {
              type: "object",
              properties: {
                id: { type: "number", description: "ID of the event to delete" },
              },
              required: ["id"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "search_web",
            description: "Search the internet for current information, news, prices, weather, events, or anything that requires up-to-date data. Use this whenever the user asks about something you may not have in your training data or that changes over time.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "The search query to look up online" },
              },
              required: ["query"],
            },
          },
        },
      ];

      const MAX_TOOL_ROUNDS = 4;
      let toolsWereUsed = false;
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        // Use the fast model for tool-detection rounds — only upgrade to the chosen
        // model on the final response round (after all tools have been executed).
        const roundModel = toolsWereUsed ? chosenModel : FAST_MODEL;
        const stream = await withRetry(() => openai.chat.completions.create({
          model: roundModel,
          messages: chatMessages,
          tools: diaryFunctions,
          tool_choice: "auto",
          stream: true,
        }));

        let pendingToolCall: { id: string; name: string; args: string } | null = null;
        let finishReason: string | null = null;

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          finishReason = chunk.choices[0]?.finish_reason ?? finishReason;

          // Stream text content
          if (delta?.content) {
            fullResponse += delta.content;
            sseWrite({ content: delta.content });
          }

          // Accumulate tool call
          if (delta?.tool_calls?.[0]) {
            const tc = delta.tool_calls[0];
            if (tc.id) {
              // New tool call starting
              pendingToolCall = { id: tc.id, name: tc.function?.name ?? "", args: "" };
            }
            if (pendingToolCall && tc.function?.arguments) {
              pendingToolCall.args += tc.function.arguments;
            }
            if (pendingToolCall && tc.function?.name && !pendingToolCall.name) {
              pendingToolCall.name = tc.function.name;
            }
          }
        }

        // If no tool call was made, we're done
        if (finishReason !== "tool_calls" || !pendingToolCall) break;

        const isSearch = pendingToolCall.name === "search_web";
        sseWrite({ thinking: isSearch ? "Searching the web..." : "Managing your diary..." });

        let parsedArgs: Record<string, any> = {};
        try { parsedArgs = JSON.parse(pendingToolCall.args || "{}"); } catch { /* ignore */ }

        toolsWereUsed = true;
        const toolResult = isSearch
          ? await executeWebSearch(parsedArgs.query ?? "")
          : await executeDiaryTool(pendingToolCall.name, parsedArgs, userId);

        // Add assistant tool-call message and tool result to the message chain
        chatMessages.push({
          role: "assistant",
          tool_calls: [{
            id: pendingToolCall.id,
            type: "function",
            function: { name: pendingToolCall.name, arguments: pendingToolCall.args },
          }],
        });
        chatMessages.push({
          role: "tool",
          tool_call_id: pendingToolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
    }

    // Save assistant response
    if (fullResponse) {
      await db.insert(messages).values({
        conversationId: convId,
        role: "assistant",
        content: fullResponse,
      });

      // Fire-and-forget: update user memory and embed this exchange for future recall
      updateUserMemory(userId, memory, message.trim(), fullResponse).catch(() => {});
      const chunkText = `User: ${message.trim().slice(0, 500)}\nSky: ${fullResponse.trim().slice(0, 1500)}`;
      storeMemoryChunk(userId, chunkText, "conversation", String(convId)).catch(() => {});
    }

    // Auto-title the conversation on first reply (title was "New conversation")
    if (convo.title === "New conversation" && fullResponse) {
      try {
        const titleResp = await openai.chat.completions.create({
          model: FAST_MODEL,
          messages: [
            { role: "user", content: message.trim() },
            { role: "assistant", content: fullResponse },
            { role: "user", content: 'Give this conversation a short title in 5 words or fewer. Reply with ONLY the title — no quotes, no punctuation, no full stop.' },
          ],
          max_tokens: 20,
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

    // Generate follow-up suggestions
    if (fullResponse) {
      try {
        const suggestResp = await openai.chat.completions.create({
          model: FAST_MODEL,
          messages: [
            { role: "user", content: message.trim() },
            { role: "assistant", content: fullResponse.slice(0, 800) },
            { role: "user", content: "Give exactly 3 short follow-up questions or actions the user might want next. Reply with ONLY a JSON array of 3 strings, no other text." },
          ],
          max_tokens: 120,
        });
        const raw = suggestResp.choices[0]?.message?.content?.trim() ?? "[]";
        const suggestions = JSON.parse(raw.replace(/```json|```/g, "").trim());
        if (Array.isArray(suggestions) && suggestions.length) sseWrite({ suggestions });
      } catch { /* suggestions optional */ }
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

// ─── Text-to-speech ───────────────────────────────────────────────────────────
router.post("/sky-vision/tts", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { text } = req.body as { text: string };
  if (!text?.trim()) { res.status(400).json({ error: "text required" }); return; }

  try {
    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "nova",
      input: text.trim().slice(0, 4096),
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err: any) {
    console.error("TTS error:", err?.message);
    res.status(500).json({ error: "TTS failed" });
  }
});

// ─── Speech-to-text ───────────────────────────────────────────────────────────
router.post("/sky-vision/transcribe", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { audioBase64, mimeType = "audio/webm" } = req.body as { audioBase64: string; mimeType?: string };
  if (!audioBase64) { res.status(400).json({ error: "audioBase64 required" }); return; }

  try {
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
    const buffer = Buffer.from(audioBase64, "base64");
    const audioFile = await toFile(buffer, `audio.${ext}`, { type: mimeType });
    const transcription = await openai.audio.transcriptions.create({
      model: "gpt-4o-transcribe",
      file: audioFile,
      prompt:
        "Firesky Industries, fire protection, suppression system, sprinkler, deluge, " +
        "zone valve, HDPE pipe, CPVC, wet pipe, dry pipe, pre-action, foam system, " +
        "hydrant, hose reel, pump set, jockey pump, diesel pump, electric pump, " +
        "flow switch, pressure switch, alarm valve, check valve, gate valve, ball valve, " +
        "The Factory, branch, stock, enquiry, quotation, job card, inspection.",
    });
    res.json({ text: transcription.text });
  } catch (err: any) {
    console.error("Transcription error:", err?.message);
    res.status(500).json({ error: "Transcription failed" });
  }
});

// ─── Image generation (text → image) ─────────────────────────────────────────
router.post("/sky-vision/generate-image", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { prompt } = req.body as { prompt: string };
  if (!prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  try {
    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt.trim(),
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const b64 = result.data?.[0]?.b64_json;
    const revisedPrompt = result.data?.[0]?.revised_prompt;
    if (!b64) throw new Error("No image returned");

    res.json({ imageBase64: b64, mimeType: "image/png", revisedPrompt });
  } catch (err: any) {
    console.error("Image generation error:", err?.message);
    res.status(500).json({ error: "Image generation failed. Please try a different prompt." });
  }
});

// ─── Image editing ────────────────────────────────────────────────────────────
router.post("/sky-vision/edit-image", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { imageBase64, mimeType = "image/png", prompt } = req.body as {
    imageBase64: string;
    mimeType?: string;
    prompt: string;
  };

  if (!imageBase64 || !prompt?.trim()) {
    res.status(400).json({ error: "imageBase64 and prompt are required" });
    return;
  }

  try {
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const imageFile = await toFile(imageBuffer, "image.png", { type: "image/png" });

    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: prompt.trim(),
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");

    res.json({ imageBase64: b64, mimeType: "image/png" });
  } catch (err: any) {
    console.error("Image edit error:", err?.message);
    res.status(500).json({ error: "Image editing failed. Please try a different prompt or image." });
  }
});

// ─── Memory CRUD ─────────────────────────────────────────────────────────────
router.get("/sky-vision/memory", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [row] = await db.select().from(userMemories).where(eq(userMemories.userId, userId));
  res.json({ content: row?.content ?? "" });
});

router.put("/sky-vision/memory", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { content } = req.body as { content: string };
  await db.insert(userMemories).values({ userId, content: content ?? "", updatedAt: new Date() })
    .onConflictDoUpdate({ target: userMemories.userId, set: { content: content ?? "", updatedAt: new Date() } });
  res.json({ ok: true });
});

router.delete("/sky-vision/memory", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  await db.update(userMemories).set({ content: "", updatedAt: new Date() }).where(eq(userMemories.userId, userId));
  res.json({ ok: true });
});

// ─── Diary CRUD ───────────────────────────────────────────────────────────────

router.get("/sky-vision/diary", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { from, to } = req.query as { from?: string; to?: string };
  try {
    const rows = await db.execute<any>(sql`
      SELECT id, title, description, start_at, end_at, all_day, type, status, location, color, created_at
      FROM sky_diary_events
      WHERE user_id = ${userId}
        ${from ? sql`AND start_at >= ${from}::timestamptz` : sql``}
        ${to   ? sql`AND start_at <= ${to}::timestamptz`   : sql``}
      ORDER BY start_at ASC
    `);
    res.json(rows.rows ?? []);
  } catch (err) {
    console.error("[Diary] list error:", err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

router.post("/sky-vision/diary", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { title, description, start_at, end_at, all_day, type, location, color } = req.body as Record<string, any>;
  if (!title?.trim() || !start_at) { res.status(400).json({ error: "title and start_at required" }); return; }
  try {
    const rows = await db.execute<any>(sql`
      INSERT INTO sky_diary_events (user_id, title, description, start_at, end_at, all_day, type, location, color)
      VALUES (${userId}, ${title.trim()}, ${description ?? null}, ${start_at}::timestamptz,
              ${end_at ?? null}::timestamptz, ${all_day ?? false}, ${type ?? "event"},
              ${location ?? null}, ${color ?? "orange"})
      RETURNING *
    `);
    res.status(201).json(rows.rows?.[0]);
  } catch (err) {
    console.error("[Diary] create error:", err);
    res.status(500).json({ error: "Failed to create event" });
  }
});

router.put("/sky-vision/diary/:id", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  const { title, description, start_at, end_at, all_day, type, status, location, color } = req.body as Record<string, any>;
  try {
    await db.execute(sql`
      UPDATE sky_diary_events SET
        title       = COALESCE(${title       ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        start_at    = CASE WHEN ${start_at !== undefined} THEN ${start_at ?? null}::timestamptz ELSE start_at END,
        end_at      = CASE WHEN ${end_at   !== undefined} THEN ${end_at   ?? null}::timestamptz ELSE end_at   END,
        all_day     = COALESCE(${all_day   ?? null}, all_day),
        type        = COALESCE(${type      ?? null}, type),
        status      = COALESCE(${status    ?? null}, status),
        location    = COALESCE(${location  ?? null}, location),
        color       = COALESCE(${color     ?? null}, color),
        updated_at  = NOW()
      WHERE id = ${id} AND user_id = ${userId}
    `);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Diary] update error:", err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

router.delete("/sky-vision/diary/:id", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  try {
    await db.execute(sql`DELETE FROM sky_diary_events WHERE id = ${id} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Diary] delete error:", err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// ─── Vector Memory Chunks API ─────────────────────────────────────────────────

router.get("/sky-vision/memories/chunks", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await db.execute<{ id: number; content: string; source: string; created_at: string }>(
      sql`SELECT id, content, source, created_at
          FROM sky_memory_chunks
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 100`
    );
    res.json(rows.rows ?? []);
  } catch (err) {
    console.error("[Sky memory] List chunks error:", err);
    res.json([]);
  }
});

router.delete("/sky-vision/memories/chunks", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    await db.execute(sql`DELETE FROM sky_memory_chunks WHERE user_id = ${userId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Sky memory] Delete all chunks error:", err);
    res.status(500).json({ error: "Failed to delete memory" });
  }
});

router.delete("/sky-vision/memories/chunks/:id", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.execute(sql`DELETE FROM sky_memory_chunks WHERE id = ${id} AND user_id = ${userId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Sky memory] Delete chunk error:", err);
    res.status(500).json({ error: "Failed to delete" });
  }
});

router.post("/sky-vision/memories/embed", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { content } = req.body as { content: string };
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }
  try {
    await storeMemoryChunk(userId, content.trim(), "manual");
    res.json({ ok: true });
  } catch (err) {
    console.error("[Sky memory] Manual embed error:", err);
    res.status(500).json({ error: "Failed to embed" });
  }
});

// ─── Saved Prompts CRUD ───────────────────────────────────────────────────────
router.get("/sky-vision/prompts", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const prompts = await db.select().from(savedPrompts)
    .where(eq(savedPrompts.userId, userId))
    .orderBy(desc(savedPrompts.createdAt));
  res.json(prompts);
});

router.post("/sky-vision/prompts", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { title, content } = req.body as { title: string; content: string };
  if (!title?.trim() || !content?.trim()) { res.status(400).json({ error: "title and content required" }); return; }
  const [prompt] = await db.insert(savedPrompts).values({ userId, title: title.trim(), content: content.trim() }).returning();
  res.status(201).json(prompt);
});

router.delete("/sky-vision/prompts/:id", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  await db.delete(savedPrompts).where(and(eq(savedPrompts.id, id), eq(savedPrompts.userId, userId)));
  res.status(204).send();
});

// ─── File parsing (PDF / DOCX / CSV / TXT) ───────────────────────────────────
router.post("/sky-vision/parse-file", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { fileBase64, mimeType, fileName } = req.body as { fileBase64: string; mimeType: string; fileName: string };
  if (!fileBase64 || !mimeType) { res.status(400).json({ error: "fileBase64 and mimeType required" }); return; }

  try {
    const buffer = Buffer.from(fileBase64, "base64");
    let text = "";

    const timeout = <T>(ms: number, promise: Promise<T>): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("File parse timed out")), ms)
        ),
      ]);

    if (mimeType === "application/pdf") {
      const parsed = await timeout(30000, pdfParse(buffer));
      text = parsed.text;
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimeType === "application/msword") {
      const result = await timeout(30000, mammoth.extractRawText({ buffer }));
      text = result.value;
    } else {
      text = buffer.toString("utf-8");
    }

    // Trim and cap at 40 000 chars (~30k tokens)
    text = text.trim().slice(0, 40000);
    if (!text) { res.status(422).json({ error: "Could not extract text from this file." }); return; }

    res.json({ text, fileName });
  } catch (err: any) {
    console.error("File parse error:", err?.message);
    res.status(500).json({ error: "Failed to read the file. Please try a different format." });
  }
});

export default router;
