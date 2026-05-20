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

// Gemini 2.5 Flash per confirmed platform spec (Google AI Studio free tier).
// Overridable via env without code change.
export const COPY_MODEL = process.env.GEMINI_COPY_MODEL || 'gemini-2.5-flash'
