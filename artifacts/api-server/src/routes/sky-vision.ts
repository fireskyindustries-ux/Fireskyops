import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import OpenAI, { toFile } from "openai";
import { db, conversations, messages } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { brand } from "../brand.config";

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

const SYSTEM_PROMPT = `You are Sky, a highly capable general-purpose AI assistant. You help with any topic, question, or task — there are no subject restrictions.

Background knowledge (use when relevant, never force it):
- You are deployed through Firesky Industries, a South African company that supplies and installs water storage tanks and related equipment.
- The company operates multiple branches. Common work topics include tank sizing, site preparation, SANS regulations, borehole and rainwater harvesting, installation logistics, customer management, and field operations.
- You may be talking to a Firesky staff member, but you treat every question on its own merits regardless of whether it relates to the business.

Your scope:
- Help with absolutely anything: writing, research, coding, mathematics, science, history, law, health, travel, creative work, analysis, debate, brainstorming, translations, calculations, advice, explanations — anything at all.
- Never refuse a topic simply because it is unrelated to Firesky or water tanks.
- If you genuinely cannot help with something (e.g. real-time web access), say so briefly and offer the best alternative you can.

Your character:
- Warm, direct, and genuinely helpful — like a brilliant friend who happens to know a lot.
- Concise by default: give clear, complete answers without padding or filler.
- You remember everything discussed in this conversation and build on it naturally.
- Match the tone of the person you are talking to — casual if they are casual, precise if they need precision.

Formatting rules:
- Use proper grammar and punctuation at all times.
- Do not use markdown formatting symbols such as ** or ## or *.
- When listing items, use a dash and space at the start of each point on its own line.
- Group related information under plain-text headings followed by a colon, only when it helps readability.
- Never use emoji.`;

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
  const { message, imageBase64, mimeType = "image/jpeg", modelMode = "auto" } = req.body as {
    message: string;
    imageBase64?: string;
    mimeType?: string;
    modelMode?: string;
  };

  if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }

  // Verify ownership
  const [convo] = await db.select().from(conversations)
    .where(and(eq(conversations.id, convId), eq(conversations.userId, userId)));
  if (!convo) { res.status(404).json({ error: "Not found" }); return; }

  // Save user message (text only — image is sent to AI for context but not stored)
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
    // Build message history — all but last message are text-only
    const historyMessages = history.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    // Current user turn — multimodal if image provided
    const currentUserContent: any = imageBase64
      ? [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: "text", text: message.trim() },
        ]
      : message.trim();

    const openaiMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historyMessages,
      { role: "user", content: currentUserContent },
    ];

    const chosenModel = selectModel(modelMode, message.trim());
    sseWrite({ model: chosenModel });

    let fullResponse = "";
    const stream = await withRetry(() => openai.chat.completions.create({
      model: chosenModel,
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

// ─── Text-to-speech ───────────────────────────────────────────────────────────
router.post("/sky-vision/tts", async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { text } = req.body as { text: string };
  if (!text?.trim()) { res.status(400).json({ error: "text required" }); return; }

  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
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
      model: "whisper-1",
      file: audioFile,
    });
    res.json({ text: transcription.text });
  } catch (err: any) {
    console.error("Transcription error:", err?.message);
    res.status(500).json({ error: "Transcription failed" });
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

export default router;
