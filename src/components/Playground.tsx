import { useState, useRef, useEffect, useCallback } from 'react'
import { useStreamingInference } from '../hooks/useStreamingInference'
import { InputPanel } from './InputPanel'
import { MetricsBar } from './MetricsBar'
import { OutputPanel } from './OutputPanel'
import { ErrorBanner } from './ErrorBanner'

export function Playground() {
  const { output, tokenCount, tokensPerSec, isStreaming, error, run, abort, clear } = useStreamingInference()
  const [currentPrompt, setCurrentPrompt] = useState('')
  const outputRef = useRef<HTMLDivElement>(null)

  const handleSubmit = useCallback((prompt: string) => {
    setCurrentPrompt(prompt)
    run(prompt)
  }, [run])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isStreaming) { e.preventDefault(); abort() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isStreaming, abort])

  useEffect(() => { if (output) outputRef.current?.focus() }, [output])

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-h)' }}>Inference Playground</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>Test on-device model inference with real-time streaming.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InputPanel onSubmit={handleSubmit} disabled={isStreaming} />

        <div className="flex flex-col gap-3">
          {isStreaming && (
            <div className="flex items-center justify-between">
              <MetricsBar tokenCount={tokenCount} tokensPerSec={tokensPerSec} />
              <button
                onClick={abort}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
              >
                Stop (Esc)
              </button>
            </div>
          )}
          {!isStreaming && tokenCount > 0 && (
            <MetricsBar tokenCount={tokenCount} tokensPerSec={tokensPerSec} />
          )}

          <div ref={outputRef} tabIndex={-1}>
            <OutputPanel output={output} isStreaming={isStreaming} />
          </div>

          {error && (
            <ErrorBanner error={error} onRetry={() => run(currentPrompt)} onClear={clear} />
          )}
        </div>
      </div>
    </div>
  )
}
