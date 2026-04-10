import OpenAI from "openai";

// Prefer a direct API key if provided (works in all environments including production deployments).
// Fall back to the Replit AI integration proxy for development convenience.
const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const baseURL = process.env.OPENAI_API_KEY
  ? undefined // use OpenAI's default base URL
  : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

if (!apiKey) {
  throw new Error(
    "No OpenAI credentials found. Set OPENAI_API_KEY or provision the Replit OpenAI AI integration.",
  );
}

export const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
