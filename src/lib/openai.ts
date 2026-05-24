import OpenAI from 'openai'

// Instantiated lazily so the missing-key error surfaces at call time, not import time.
let _client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}
