import { GoogleGenerativeAI } from '@google/generative-ai'

// Singleton Gemini client. API key is read from env (never committed).
let _client: GoogleGenerativeAI | null = null

export function getGeminiClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set in .env.local')
  }
  if (!_client) {
    _client = new GoogleGenerativeAI(key)
  }
  return _client
}

// Gemini 3.5 Flash (GA 2026-05) — 取代已淘汰的 2.5 Flash,推理/指令遵循更強、成本相近。
// Overridable via env without code change(想省成本可降回 gemini-3.1-flash-lite)。
export const COPY_MODEL = process.env.GEMINI_COPY_MODEL || 'gemini-3.5-flash'
