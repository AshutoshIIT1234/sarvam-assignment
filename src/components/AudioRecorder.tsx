import { useState, useRef, useEffect } from 'react'
import { transcribeAudio } from '../api/transcribe'

interface AudioRecorderProps {
  onTranscript: (text: string) => void
  onError: (error: string) => void
  disabled?: boolean
}

export function AudioRecorder({ onTranscript, onError, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  // Use a ref for the rAF loop to avoid stale closure / self-reference lint error
  const drawWaveformRef = useRef<() => void>(() => undefined)

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.scale(dpr, dpr)
    }
    const W = rect.width
    const H = rect.height

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteTimeDomainData(dataArray)

    ctx.fillStyle = '#16161f'
    ctx.fillRect(0, 0, W, H)
    ctx.shadowColor = '#8b5cf6'
    ctx.shadowBlur = 6
    ctx.lineWidth = 2
    ctx.strokeStyle = '#8b5cf6'
    ctx.beginPath()

    const sliceWidth = W / dataArray.length
    let x = 0
    for (let i = 0; i < dataArray.length; i++) {
      const y = ((dataArray[i] ?? 128) / 128.0) * (H / 2)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
    ctx.lineTo(W, H / 2)
    ctx.stroke()
    ctx.shadowBlur = 0

    animationFrameRef.current = requestAnimationFrame(() => drawWaveformRef.current())
  }

  // Keep ref in sync so rAF callback always calls the latest version
  useEffect(() => {
    drawWaveformRef.current = drawWaveform
  })

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      audioContextRef.current = audioContext
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setIsProcessing(true)
        try {
          onTranscript(await transcribeAudio(blob))
        } catch (err) {
          onError(err instanceof Error ? err.message : 'Transcription failed')
        } finally {
          setIsProcessing(false)
        }
        stream.getTracks().forEach((t) => t.stop())
        void audioContextRef.current?.close()
        audioContextRef.current = null
        analyserRef.current = null
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100)
      setIsRecording(true)
      drawWaveformRef.current()
    } catch {
      onError('Could not access microphone. Please grant permission.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    }
  }

  // Draw idle flat line when not recording
  useEffect(() => {
    if (isRecording || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    ctx.scale(dpr, dpr)
    const W = rect.width
    const H = rect.height
    ctx.fillStyle = '#16161f'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(139,92,246,0.1)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (H / 4) * i)
      ctx.lineTo(W, (H / 4) * i)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(139,92,246,0.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, H / 2)
    ctx.lineTo(W, H / 2)
    ctx.stroke()
  }, [isRecording])

  useEffect(
    () => () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      void audioContextRef.current?.close()
    },
    []
  )

  return (
    <div className="flex flex-col gap-4">
      <canvas
        ref={canvasRef}
        width={800}
        height={144}
        role="img"
        aria-label={isRecording ? 'Live audio waveform' : 'Audio waveform (idle)'}
        className="w-full rounded-xl"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', height: '72px' }}
      />
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isProcessing ? 'Processing audio…' : isRecording ? 'Recording in progress' : ''}
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          onKeyDown={(e) => {
            if (e.key === ' ' && !disabled && !isProcessing) {
              e.preventDefault()
              if (isRecording) stopRecording()
              else void startRecording()
            }
          }}
          disabled={disabled || isProcessing}
          aria-pressed={isRecording}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          style={
            isRecording
              ? { background: 'linear-gradient(135deg, #dc2626, #ef4444)', boxShadow: '0 0 16px rgba(239,68,68,0.4)' }
              : { background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 0 16px rgba(139,92,246,0.3)' }
          }
        >
          <span
            className={`h-2.5 w-2.5 rounded-full bg-white ${isRecording ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          />
          {isProcessing ? 'Processing…' : isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>

      <p className="text-center text-xs" style={{ color: 'var(--text)' }}>
        Press{' '}
        <kbd
          className="rounded px-1.5 py-0.5 text-xs font-semibold"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-h)' }}
        >
          Space
        </kbd>{' '}
        or click to {isRecording ? 'stop' : 'start'} recording
      </p>
    </div>
  )
}
