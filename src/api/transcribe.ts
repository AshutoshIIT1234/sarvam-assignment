export async function transcribeAudio(
  audioBlob: Blob,
  signal?: AbortSignal
): Promise<string> {
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
    const errorText = await response.text()
    throw new Error(`Transcription failed: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.transcript || data.text || ''
}