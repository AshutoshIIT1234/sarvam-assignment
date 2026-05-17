import { useState, useCallback } from 'react'
import { computeTokenDiff, getSummary, changeScore, type DiffToken } from '../utils/diff'
import { streamChat } from '../api/chat'
import { stripThinkBlocks } from '../utils/stripThinkBlocks'
import type { ChatMessage } from '../types'

const MODELS = [
  { value: 'sarvam-30b',  label: 'Sarvam-30B',       context: '64K',  desc: 'Balanced' },
  { value: 'sarvam-105b', label: 'Sarvam-105B',      context: '128K', desc: 'Flagship' },
  { value: 'sarvam-m',    label: 'Sarvam-M',         context: '32K',  desc: 'Legacy' },
]

async function fetchFullResponse(prompt: string, model: string, signal: AbortSignal): Promise<string> {
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }]
  let result = ''
  for await (const token of streamChat(messages, model, signal)) {
    result += token
  }
  return stripThinkBlocks(result)
}

function TokenSpan({
  text,
  state,
  title,
}: {
  text: string
  state: DiffToken['state']
  title?: string
}) {
  const styles: Record<DiffToken['state'], React.CSSProperties> = {
    equal: { color: 'var(--text-h)' },
    added: {
      background: 'rgba(34,197,94,0.15)',
      color: '#4ade80',
      borderRadius: '3px',
      padding: '0 2px',
    },
    deleted: {
      background: 'rgba(239,68,68,0.15)',
      color: '#f87171',
      borderRadius: '3px',
      padding: '0 2px',
      textDecoration: 'line-through',
    },
    paraphrased: {
      background: 'rgba(234,179,8,0.15)',
      color: '#fbbf24',
      borderRadius: '3px',
      padding: '0 2px',
    },
  }
  return (
    <span style={styles[state]} title={title} aria-label={`${state}: ${text}`} className="text-sm">
      {text}{' '}
    </span>
  )
}

export function DiffView() {
  const [prompt, setPrompt] = useState('')
  const [modelA, setModelA] = useState('sarvam-30b')
  const [modelB, setModelB] = useState('sarvam-105b')
  const [outputA, setOutputA] = useState('')
  const [outputB, setOutputB] = useState('')
  const [diff, setDiff] = useState<DiffToken[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = useCallback(async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setOutputA('')
    setOutputB('')
    setDiff([])
    const controller = new AbortController()
    try {
      const [a, b] = await Promise.all([
        fetchFullResponse(prompt, modelA, controller.signal),
        fetchFullResponse(prompt, modelB, controller.signal),
      ])
      setOutputA(a)
      setOutputB(b)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [prompt, modelA, modelB])

  const summary = diff.length > 0 ? getSummary(diff) : null
  const score = diff.length > 0 ? changeScore(diff) : null

  const leftTokens = diff.filter(
    (t) => t.state === 'equal' || t.state === 'deleted' || t.state === 'paraphrased'
  )
  const rightTokens = diff.filter(
    (t) => t.state === 'equal' || t.state === 'added' || t.state === 'paraphrased'
  )

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-h)',
    borderRadius: '12px',
    padding: '12px 16px',
    width: '100%',
    fontSize: '14px',
    resize: 'vertical' as const,
    outline: 'none',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-h)' }}>
          Model Output Diff View
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
          Token-level side-by-side comparison of two model outputs.
        </p>
      </div>

      {/* Prompt + Models */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <label
          htmlFor="diff-prompt"
          className="block text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--accent-2, #a78bfa)' }}
        >
          Prompt
        </label>
        <div className="flex gap-2 mb-4">
          <input
            id="diff-prompt"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleRun()
            }}
            placeholder="Enter a prompt… (Enter to run)"
            style={{ ...inputStyle, borderRadius: '10px', flex: 1 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <button
            onClick={() => void handleRun()}
            disabled={!prompt.trim() || loading}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', whiteSpace: 'nowrap' }}
          >
            {loading ? 'Running…' : 'Run'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              id: 'model-a', label: 'Model A', value: modelA,
              set: (v: string) => { setModelA(v); if (v === modelB) setModelB(modelA) },
              other: modelB,
            },
            {
              id: 'model-b', label: 'Model B', value: modelB,
              set: (v: string) => { setModelB(v); if (v === modelA) setModelA(modelB) },
              other: modelA,
            },
          ].map(({ id, label, value, set, other }) => (
            <div key={id}>
              <p
                id={`${id}-label`}
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'var(--accent-2, #a78bfa)' }}
              >
                {label}
              </p>
              <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-col gap-1.5">
                {MODELS.map((m) => {
                  const selected = value === m.value
                  const disabled = m.value === other
                  return (
                    <button
                      key={m.value}
                      role="radio"
                      aria-checked={selected}
                      disabled={disabled}
                      onClick={() => !disabled && set(m.value)}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-35 disabled:cursor-not-allowed"
                      style={{
                        background: selected
                          ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.15))'
                          : 'var(--bg-input)',
                        border: `1px solid ${selected ? '#7c3aed' : 'var(--border)'}`,
                        boxShadow: selected ? '0 0 0 1px rgba(124,58,237,0.3)' : 'none',
                      }}
                    >
                      <div>
                        <div className="text-sm font-semibold" style={{ color: selected ? '#c4b5fd' : 'var(--text-h)' }}>
                          {m.label}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
                          {m.context} · {m.desc}
                        </div>
                      </div>
                      {selected && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 ml-2">
                          <circle cx="8" cy="8" r="7" stroke="#7c3aed" strokeWidth="1.5" />
                          <circle cx="8" cy="8" r="3.5" fill="#a855f7" />
                        </svg>
                      )}
                      {disabled && (
                        <span className="text-xs ml-2 shrink-0" style={{ color: 'var(--text)' }}>in use</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          {error}
        </div>
      )}

      {/* Raw outputs */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          {
            id: 'output-a',
            label: modelA,
            value: outputA,
            set: (v: string) => {
              setOutputA(v)
              setDiff([])
            },
          },
          {
            id: 'output-b',
            label: modelB,
            value: outputB,
            set: (v: string) => {
              setOutputB(v)
              setDiff([])
            },
          },
        ].map(({ id, label, value, set }) => (
          <div key={id} className="flex flex-col gap-2">
            <label
              htmlFor={id}
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--accent-2, #a78bfa)' }}
            >
              {label}
            </label>
            <textarea
              id={id}
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={loading ? 'Fetching…' : `${label} will appear here…`}
              rows={4}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setDiff(computeTokenDiff(outputA, outputB))}
          disabled={!outputA || !outputB}
          className="px-6 py-2 rounded-xl text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
        >
          Compare Outputs
        </button>
        <button
          onClick={() => {
            setPrompt('')
            setOutputA('')
            setOutputB('')
            setDiff([])
            setError(null)
          }}
          className="px-6 py-2 rounded-xl text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-gray-500"
          style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          Clear
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div
          className="flex flex-wrap items-center gap-5 rounded-xl px-5 py-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          aria-live="polite"
        >
          {[
            { color: '#f87171', label: `${summary.removed} removed` },
            { color: '#4ade80', label: `${summary.added} added` },
            { color: '#fbbf24', label: `${summary.paraphrased} paraphrased` },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: color }}
                aria-hidden="true"
              />
              <span className="text-sm" style={{ color: 'var(--text)' }}>
                {label}
              </span>
            </div>
          ))}
          {score !== null && (
            <span
              className="ml-auto text-sm font-semibold"
              style={{ color: 'var(--accent-2, #a78bfa)' }}
            >
              {score}% changed
            </span>
          )}
        </div>
      )}

      {/* Side-by-side diff */}
      {diff.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {/* Legend */}
          <div
            className="flex gap-4 px-5 py-2.5 text-xs"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
          >
            {[
              { bg: 'rgba(239,68,68,0.15)', color: '#f87171', label: 'removed' },
              { bg: 'rgba(34,197,94,0.15)', color: '#4ade80', label: 'added' },
              { bg: 'rgba(234,179,8,0.15)', color: '#fbbf24', label: 'paraphrased' },
            ].map(({ bg, color, label }) => (
              <span
                key={label}
                style={{ background: bg, color, borderRadius: '4px', padding: '1px 6px' }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
            {[
              { label: modelA, tokens: leftTokens, side: 'left' as const },
              { label: modelB, tokens: rightTokens, side: 'right' as const },
            ].map(({ label, tokens, side }) => (
              <div key={side} className="p-5" style={{ background: 'var(--bg-card)' }}>
                <h3
                  className="text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--accent-2, #c4b5fd)' }}
                >
                  {label}
                </h3>
                <div
                  className="flex flex-wrap gap-y-1 leading-relaxed"
                  role="region"
                  aria-label={`${label} diff`}
                >
                  {tokens.map((token, i) => {
                    const text =
                      side === 'left' ? (token.tokenA ?? '') : (token.tokenB ?? token.tokenA ?? '')
                    const title =
                      token.state === 'paraphrased'
                        ? side === 'left'
                          ? `→ "${token.tokenB}" (sim: ${token.similarity?.toFixed(2)})`
                          : `← "${token.tokenA}" (sim: ${token.similarity?.toFixed(2)})`
                        : undefined
                    return <TokenSpan key={i} text={text} state={token.state} title={title} />
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
