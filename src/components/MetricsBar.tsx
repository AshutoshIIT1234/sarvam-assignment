interface MetricsBarProps {
  tokenCount: number
  tokensPerSec: number
}

export function MetricsBar({ tokenCount, tokensPerSec }: MetricsBarProps) {
  return (
    <div
      className="flex items-center gap-6 rounded-xl px-5 py-3"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      aria-label="Live metrics"
      aria-live="polite"
      aria-atomic="true"
    >
      <Metric label="Tokens" value={`~${tokenCount}`} />
      <div className="w-px h-4" style={{ background: 'var(--border)' }} aria-hidden="true" />
      <Metric label="Speed" value={`${tokensPerSec.toFixed(1)} tok/s`} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text)' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: 'var(--accent-2, #a78bfa)' }}>{value}</span>
    </div>
  )
}
