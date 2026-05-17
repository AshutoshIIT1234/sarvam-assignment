import { useState, useRef, useCallback } from 'react'
import type { StreamError, ChatMessage } from '../types'
import { streamChat } from '../api/chat'

const TIMEOUT_MS = 30_000

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

  const abortControllerRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTokenCountRef = useRef(0)

  const run = useCallback(async (prompt: string, model: string = 'sarvam-m') => {
    setIsStreaming(true)
    setError(null)
    setOutput('')
    setTokenCount(0)
    setTokensPerSec(0)
    lastTokenCountRef.current = 0

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const timeout = setTimeout(() => {
      abortController.abort()
    }, TIMEOUT_MS)
    timeoutRef.current = timeout

    startTimeRef.current = Date.now()

    const messages: ChatMessage[] = [
      { role: 'user', content: prompt }
    ]

    try {
      for await (const token of streamChat(messages, model, abortController.signal)) {
        setOutput((prev) => {
          const raw = prev + token
          // Strip <think>...</think> blocks — opening tag may be missing in stream
          return raw
            .replace(/<think>[\s\S]*?<\/think>\n?/gi, '')  // complete block
            .replace(/^[\s\S]*?<\/think>\n?/, '')           // block without opening tag
            .replace(/<think>[\s\S]*$/i, '')                // in-progress block
            .trimStart()
        })

        const newTokenCount = lastTokenCountRef.current + token.split(/\s+/).filter(Boolean).length
        lastTokenCountRef.current = newTokenCount
        setTokenCount(newTokenCount)

        const elapsed = (Date.now() - startTimeRef.current) / 1000
        if (elapsed > 0) {
          setTokensPerSec(newTokenCount / elapsed)
        }
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        const isTimeout = timeoutRef.current !== null
        if (isTimeout && !abortControllerRef.current) {
          setError({
            type: 'timeout',
            message: 'Request timed out after 30 seconds.',
          })
        } else {
          setError({
            type: 'aborted',
            message: 'Stopped.',
          })
        }
      } else if (err instanceof Error) {
        const status = (err as Error & { status?: number }).status
        if (status) {
          setError({
            type: 'http',
            message: `HTTP error: ${status}`,
            statusCode: status,
          })
        } else {
          setError({
            type: 'network',
            message: 'Connection lost. Partial output preserved.',
          })
        }
      } else {
        setError({
          type: 'network',
          message: 'An unknown error occurred.',
        })
      }
    } finally {
      clearTimeout(timeout)
      timeoutRef.current = null
      abortControllerRef.current = null
      setIsStreaming(false)
    }
  }, [])

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  const clear = useCallback(() => {
    setOutput('')
    setTokenCount(0)
    setTokensPerSec(0)
    setError(null)
    setIsStreaming(false)
  }, [])

  return {
    output,
    tokenCount,
    tokensPerSec,
    isStreaming,
    error,
    run,
    abort,
    clear,
  }
}