import type { ChatMessage } from '../types'

export async function* streamChat(
  messages: ChatMessage[],
  model: string = 'sarvam-m',
  signal?: AbortSignal
): AsyncGenerator<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  })

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  if (!response.body) throw new Error('Response body is null')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') return

        try {
          const token = JSON.parse(payload).choices?.[0]?.delta?.content ?? ''
          if (token) yield token
        } catch {
          // skip malformed SSE chunk
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
