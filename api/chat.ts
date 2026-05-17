import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.SARVAM_API_KEY
  if (!apiKey) {
    return response.status(500).json({ error: 'API key not configured' })
  }

  const { messages, model = 'sarvam-m', stream = true } = request.body

  try {
    const sarvamResponse = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
      }),
    })

    if (!sarvamResponse.ok) {
      const errorText = await sarvamResponse.text()
      return response.status(sarvamResponse.status).json({ 
        error: `Sarvam API error: ${errorText}` 
      })
    }

    if (stream) {
      response.setHeader('Content-Type', 'text/event-stream')
      response.setHeader('Cache-Control', 'no-cache')
      response.setHeader('Connection', 'keep-alive')

      const reader = sarvamResponse.body?.getReader()
      if (!reader) {
        return response.status(500).json({ error: 'Failed to read stream' })
      }

      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          response.write(chunk)
        }
      } finally {
        reader.releaseLock()
      }
      response.end()
    } else {
      const data = await sarvamResponse.json()
      return response.status(200).json(data)
    }
  } catch (error) {
    console.error('Proxy error:', error)
    return response.status(500).json({ error: 'Failed to proxy request' })
  }
}