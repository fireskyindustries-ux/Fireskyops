import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
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
- If you genuinely cannot do something (like browse the internet in real time), you say so briefly and offer the best alternative you can — then move on.

How you remember:
- You pay attention to what people tell you and carry it forward naturally. If they mentioned something earlier in the conversation, you build on it without being prompted. You treat every conversation as a continuous thread, not a series of isolated exchanges.

Formatting rules:
- Proper grammar and punctuation at all times.
- No markdown symbols like ** or ## or *.
- When listing things, use a dash and a space at the start of each item, each on its own line.
- Plain-text headings followed by a colon only when it genuinely helps readability.
- No emoji.
- No filler phrases. No throat-clearing. Just say the thing.`;

function buildSystemPrompt(memory: string): string {
  if (!memory.trim()) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}

What you remember about this user (from previous conversations — use naturally, never recite robotically):
${memory.trim()}`;
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

  // Load user memory and save user message in parallel
  const [memory] = await Promise.all([
    getUserMemory(userId),
    db.insert(messages).values({ conversationId: convId, role: "user", content: message.trim() }),
  ]);

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
        { role: "system", content: buildSystemPrompt(memory) },
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
      // ── Text path: Responses API with web search ──────────────────────────
      const responsesInput: any[] = [
        ...historyMessages,
        { role: "user", content: userTextContent },
      ];

      const responseStream = await withRetry(() => (openai as any).responses.create({
        model: chosenModel,
        instructions: buildSystemPrompt(memory),
        input: responsesInput,
        tools: [{ type: "web_search_preview" }],
        stream: true,
      }));

      for await (const event of responseStream as AsyncIterable<any>) {
        if (event.type === "response.output_text.delta") {
          const text = event.delta ?? "";
          if (text) { fullResponse += text; sseWrite({ content: text }); }
        } else if (event.type === "response.web_search_call.in_progress") {
          sseWrite({ searching: true });
        } else if (event.type === "response.web_search_call.completed") {
          sseWrite({ searching: false });
        }
      }
    }

    // Save assistant response
    if (fullResponse) {
      await db.insert(messages).values({
        conversationId: convId,
        role: "assistant",
        content: fullResponse,
      });

      // Fire-and-forget: update user memory in background (does not block response)
      updateUserMemory(userId, memory, message.trim(), fullResponse).catch(() => {});
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
      voice: "coral",
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

    if (mimeType === "application/pdf") {
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimeType === "application/msword") {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      // CSV, TXT, and any other text-based files
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
