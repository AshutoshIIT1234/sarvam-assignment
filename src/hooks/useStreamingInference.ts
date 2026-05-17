/**
 * useStreamingInference
 *
 * The core hook that drives the inference playground. It manages the full
 * lifecycle of a streaming request: sending the prompt, consuming tokens
 * as they arrive, tracking live metrics, and handling every failure mode.
 *
 * I kept all the streaming state here so the components stay dumb —
 * they just call `run(prompt)` and react to what comes back.
 */
import { useState, useRef, useCallback } from 'react'
import type { StreamError, ChatMessage } from '../types'
import { HttpError } from '../lib/errors'
import { streamChat } from '../api/chat'
import { stripThinkBlocks } from '../utils/stripThinkBlocks'

// 30 seconds is generous for on-device inference but prevents hanging forever
const TIMEOUT_MS = 30_000

/**
 * Maps any thrown error into a typed StreamError for the UI.
 * I centralised this so the catch block in `run` stays readable
 * and error classification is easy to extend later.
 */
function toStreamError(err: unknown, timedOut: boolean): StreamError {
  if (timedOut) {
    return { type: 'timeout', message: 'Request timed out after 30 seconds.' }
  }
  if (err instanceof HttpError) {
    return { type: 'http', message: `HTTP error: ${err.status}`, statusCode: err.status }
  }
  // AbortError is thrown when the signal fires — could be user-triggered or timeout
  if (err instanceof Error && err.name === 'AbortError') {
    return { type: 'aborted', message: 'Stopped.' }
  }
  if (err instanceof Error) {
    return { type: 'network', message: 'Connection lost. Partial output preserved.' }
  }
  return { type: 'network', message: 'An unknown error occurred.' }
}

interface UseStreamingInferenceReturn {
  output: string
  tokenCount: number
  tokensPerSec: number
  isStreaming: boolean
  error: StreamError | null
  run: (prompt: string, model?: string) => Promise<void>
  abort: () => void
  clear: () => void
}

export function useStreamingInference(): UseStreamingInferenceReturn {
  const [output, setOutput] = useState('')
  const [tokenCount, setTokenCount] = useState(0)
  const [tokensPerSec, setTokensPerSec] = useState(0)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<StreamError | null>(null)

  // Refs for values that need to survive re-renders without triggering them
  const abortControllerRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<number>(0)
  const tokenCountRef = useRef(0) // mutable counter — avoids stale closure in the token loop
  const timedOutRef = useRef(false) // flag so the catch block knows why abort fired

  const run = useCallback(async (prompt: string, model = 'sarvam-m') => {
    // Fresh slate for every new run
    setIsStreaming(true)
    setError(null)
    setOutput('')
    setTokenCount(0)
    setTokensPerSec(0)
    tokenCountRef.current = 0
    timedOutRef.current = false

    const controller = new AbortController()
    abortControllerRef.current = controller

    // Auto-abort after TIMEOUT_MS — set the flag first so the catch knows it was a timeout
    const timeout = setTimeout(() => {
      timedOutRef.current = true
      controller.abort()
    }, TIMEOUT_MS)

    startTimeRef.current = Date.now()
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }]

    try {
      for await (const token of streamChat(messages, model, controller.signal)) {
        // Strip think blocks on every append — they can span multiple tokens
        setOutput((prev) => stripThinkBlocks(prev + token))

        // Approximate token count by word splits — good enough for live display
        tokenCountRef.current += token.split(/\s+/).filter(Boolean).length
        setTokenCount(tokenCountRef.current)

        const elapsed = (Date.now() - startTimeRef.current) / 1000
        if (elapsed > 0) setTokensPerSec(tokenCountRef.current / elapsed)
      }
    } catch (err) {
      // If the user clicked Stop themselves, show "Stopped" — not a real error
      const isUserStop = !timedOutRef.current && controller.signal.aborted
      setError(
        isUserStop ? { type: 'aborted', message: 'Stopped.' } : toStreamError(err, timedOutRef.current)
      )
    } finally {
      // Always clean up — whether we finished, errored, or were aborted
      clearTimeout(timeout)
      abortControllerRef.current = null
      setIsStreaming(false)
    }
  }, [])

  const abort = useCallback(() => {
    // Calling abort() on an already-aborted controller is a no-op, so this is safe
    abortControllerRef.current?.abort()
  }, [])

  const clear = useCallback(() => {
    // Reset display state only — doesn't touch isStreaming
    setOutput('')
    setTokenCount(0)
    setTokensPerSec(0)
    setError(null)
  }, [])

  return { output, tokenCount, tokensPerSec, isStreaming, error, run, abort, clear }
}
