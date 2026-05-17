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

  try {
    const formData = new FormData()
    
    const audioBuffer = Buffer.from(request.body, 'base64')
    const blob = new Blob([audioBuffer], { type: 'audio/webm' })
    formData.append('file', blob, 'recording.webm')
    formData.append('model', 'saaras:v3')
    formData.append('mode', 'transcribe')

    const sarvamResponse = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: formData,
    })

    if (!sarvamResponse.ok) {
      const errorText = await sarvamResponse.text()
      return response.status(sarvamResponse.status).json({ 
        error: `Sarvam API error: ${errorText}` 
      })
    }

    const data = await sarvamResponse.json()
    return response.status(200).json(data)
  } catch (error) {
    console.error('Transcribe proxy error:', error)
    return response.status(500).json({ error: 'Failed to transcribe audio' })
  }
}