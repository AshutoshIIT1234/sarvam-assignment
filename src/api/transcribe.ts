/**
 * Sends a recorded audio blob to the Sarvam speech-to-text API (Saaras v3)
 * and returns the transcript as a plain string.
 *
 * The API can return either `transcript` or `text` depending on the mode,
 * so I check both and throw if neither is present — better to fail loudly
 * than silently return an empty string and confuse the user.
 */
import { HttpError } from '../lib/errors'

export async function transcribeAudio(audioBlob: Blob, signal?: AbortSignal): Promise<string> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'recording.webm')
  formData.append('model', 'saaras:v3')
  formData.append('mode', 'transcribe')

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
    signal,
  })

  if (!response.ok) {
    // Try to include the server's error message to make debugging easier
    const body = await response.text().catch(() => '')
    throw new HttpError(response.status, `Transcription failed (${response.status}): ${body}`)
  }

  const data: unknown = await response.json()

  // Sarvam STT returns `transcript` in transcribe mode
  if (
    data &&
    typeof data === 'object' &&
    'transcript' in data &&
    typeof (data as { transcript: unknown }).transcript === 'string'
  ) {
    return (data as { transcript: string }).transcript
  }

  // Some endpoints return `text` instead — handle both
  if (
    data &&
    typeof data === 'object' &&
    'text' in data &&
    typeof (data as { text: unknown }).text === 'string'
  ) {
    return (data as { text: string }).text
  }

  // If neither field exists, the API changed shape — throw so it's obvious
  throw new Error('Unexpected transcription response shape')
}
