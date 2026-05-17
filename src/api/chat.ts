/**
 * Streams chat completions from the Sarvam API token by token.
 *
 * I'm using an async generator here so the caller can just `for await` over
 * tokens as they arrive — no callbacks, no event emitters, just a clean loop.
 * The SSE (Server-Sent Events) format sends lines like:
 *   data: {"choices":[{"delta":{"content":"Hello"}}]}
 * so I buffer incomplete lines across chunks and parse each one.
 */
import type { ChatMessage } from '../types'
import { HttpError } from '../lib/errors'

export async function* streamChat(
  messages: ChatMessage[],
  model = 'sarvam-m',
  signal?: AbortSignal
): AsyncGenerator<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  })

  if (!response.ok) {
    throw new HttpError(response.status, `HTTP ${response.status}`)
  }

  if (!response.body) throw new Error('Response body is null')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  // Buffer holds the tail of the last chunk in case a line was split across two reads
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Split on newlines — complete lines are ready to parse, the last partial one stays in buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        const payload = line.slice(6).trim()

        // [DONE] is the SSE sentinel that means the stream is finished
        if (payload === '[DONE]') return

        try {
          const token: unknown = JSON.parse(payload)

          // Safely dig into choices[0].delta.content — the shape can vary
          const content =
            token &&
            typeof token === 'object' &&
            'choices' in token &&
            Array.isArray((token as { choices: unknown[] }).choices)
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ((token as any).choices[0]?.delta?.content as string | undefined) ?? ''
              : ''

          if (content) yield content
        } catch {
          // Malformed JSON in an SSE chunk — just skip it and keep going
        }
      }
    }
  } finally {
    // Always release the reader lock, even if we threw or returned early
    reader.releaseLock()
  }
}
