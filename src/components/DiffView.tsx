import { useState } from 'react'
import { computeTokenDiff, getSummary, changeScore, type DiffToken } from '../utils/diff'

const mockResponsesV1 = [
  'The car was fast and the driver was good. It zoomed through traffic with ease.',
  'A large bird flew across the sky. It was a beautiful sight to see.',
  'The important thing is to stay focused. You need to be crucial about your goals.',
]
const mockResponsesV2 = [
  'The vehicle was quick and the driver was great. It zoomed through traffic with ease.',
  'A big bird flew across the sky. It was a wonderful sight to see.',
  'The crucial thing is to stay focused. You need to be vital about your goals.',
]

function simulateResponse(prompt: string, version: 1 | 2): string {
  const hash = prompt.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return (version === 1 ? mockResponsesV1 : mockResponsesV2)[hash % mockResponsesV1.length]
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
  const [outputA, setOutputA] = useState('')
  const [outputB, setOutputB] = useState('')
  const [diff, setDiff] = useState<DiffToken[]>([])

  const handleSimulate = () => {
    if (!prompt.trim()) return
    setOutputA(simulateResponse(prompt, 1))
    setOutputB(simulateResponse(prompt, 2))
    setDiff([])
  }

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
          Token-level side-by-side comparison of two model versions.
        </p>
      </div>

      {/* Prompt */}
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
        <div className="flex gap-2">
          <input
            id="diff-prompt"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSimulate()
            }}
            placeholder="Enter a prompt… (Enter to simulate)"
            style={{ ...inputStyle, borderRadius: '10px', flex: 1 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <button
            onClick={handleSimulate}
            disabled={!prompt.trim()}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            Simulate
          </button>
        </div>
      </div>

      {/* Raw outputs */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          {
            id: 'output-a',
            label: 'Model v1',
            value: outputA,
            set: (v: string) => {
              setOutputA(v)
              setDiff([])
            },
          },
          {
            id: 'output-b',
            label: 'Model v2',
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
              placeholder={`Paste or simulate ${label} output…`}
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
              { label: 'Model v1', tokens: leftTokens, side: 'left' as const },
              { label: 'Model v2', tokens: rightTokens, side: 'right' as const },
            ].map(({ label, tokens, side }) => (
              <div key={side} className="p-5" style={{ background: 'var(--bg-card)' }}>
                <div
                  className="text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--accent-2, #a78bfa)' }}
                >
                  {label}
                </div>
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
