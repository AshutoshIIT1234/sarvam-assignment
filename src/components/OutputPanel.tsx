interface OutputPanelProps {
  output: string
  isStreaming: boolean
}

// Render a single line with inline markdown: **bold**, *italic*, `code`
function renderInline(line: string, key: number) {
  const parts: React.ReactNode[] = []
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0, m: RegExpExecArray | null

  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>)
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>)
    else if (m[4]) parts.push(
      <code key={m.index} className="rounded px-1 py-0.5 text-xs font-mono"
        style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>{m[4]}</code>
    )
    last = m.index + m[0].length
  }
  if (last < line.length) parts.push(line.slice(last))
  return <span key={key}>{parts}</span>
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i, arr) => (
    <span key={i}>
      {renderInline(line, i)}
      {i < arr.length - 1 && <br />}
    </span>
  ))
}

export function OutputPanel({ output, isStreaming }: OutputPanelProps) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Model response"
      aria-busy={isStreaming}
      className="rounded-2xl p-6 min-h-[220px]"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--accent-2, #a78bfa)' }}>Output</h2>

      {output ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-h)' }}>
          {renderMarkdown(output)}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 rounded-sm animate-pulse align-middle" style={{ background: 'var(--accent)' }} aria-hidden="true" />
          )}
        </p>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          {isStreaming ? 'Streaming response…' : 'Model response will appear here'}
        </p>
      )}
    </div>
  )
}
