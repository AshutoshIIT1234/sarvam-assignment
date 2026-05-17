import { useState, useCallback } from 'react'
import type { InputMode } from '../types'
import { ModeToggle } from './ModeToggle'
import { TextInput } from './TextInput'
import { AudioRecorder } from './AudioRecorder'

interface InputPanelProps {
  onSubmit: (text: string) => void
  disabled?: boolean
}

export function InputPanel({ onSubmit, disabled }: InputPanelProps) {
  const [mode, setMode] = useState<InputMode>('text')
  const [audioError, setAudioError] = useState<string | null>(null)

  const handleAudioTranscript = useCallback((transcript: string) => {
    setAudioError(null)
    if (transcript.trim()) onSubmit(transcript.trim())
  }, [onSubmit])

  return (
    <div className="flex flex-col gap-4 rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--accent-2, #a78bfa)' }}>Input</h2>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {audioError && (
        <div role="alert" className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#fbbf24' }}>
          {audioError}
        </div>
      )}

      {mode === 'text'
        ? <TextInput onSubmit={onSubmit} disabled={disabled} />
        : <AudioRecorder onTranscript={handleAudioTranscript} onError={setAudioError} disabled={disabled} />
      }
    </div>
  )
}
