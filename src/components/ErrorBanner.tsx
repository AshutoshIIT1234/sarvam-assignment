import type { StreamError } from '../types'

const ERROR_LABELS: Record<StreamError['type'], string> = {
  network: 'Network Error',
  timeout: 'Timeout',
  aborted: 'Stopped',
  http: 'HTTP Error',
}

interface ErrorBannerProps {
  error: StreamError
  onRetry: () => void
  onClear: () => void
}

export function ErrorBanner({ error, onRetry, onClear }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-xl p-4 flex items-start gap-3"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
    >
      <span className="text-red-400 mt-0.5" aria-hidden="true">⚠</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-400">
          {ERROR_LABELS[error.type]}{error.statusCode ? ` ${error.statusCode}` : ''}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{error.message}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onRetry}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          style={{ background: 'rgba(239,68,68,0.7)' }}
        >
          Retry
        </button>
        <button
          onClick={onClear}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
          style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
        >
          Clear
        </button>
      </div>
    </div>
  )
}
