# Part A — Inference Playground

## Overview

The Inference Playground is a browser-based developer tool that lets enterprise engineers test on-device model inference in real time. It supports both text and audio input, streams model responses token-by-token, displays live performance metrics, and handles mid-stream failures gracefully — all while remaining fully accessible via keyboard and meeting WCAG AA standards.

The playground is built in **React + TypeScript** using **Vite**, deployed on **Vercel**, and integrates directly with Sarvam AI's production APIs.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Playground UI                     │
│                                                     │
│  ┌─────────────┐        ┌───────────────────────┐   │
│  │  Input Panel│        │    Output Panel       │   │
│  │             │        │                       │   │
│  │  [Text Mode]│        │  Streamed tokens →    │   │
│  │  [Audio Mode│        │  Token count live     │   │
│  │             │        │  Tokens/sec live      │   │
│  └──────┬──────┘        └───────────────────────┘   │
│         │                                           │
└─────────┼───────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐      ┌──────────────────────┐
│  Vercel Edge Proxy  │      │  Sarvam API           │
│  /api/chat          │─────▶│  POST /v1/chat/       │
│  /api/transcribe    │      │  completions          │
│                     │      │  (stream: true)       │
└─────────────────────┘      │                       │
                             │  POST /v1/speech-to-  │
                             │  text (Saaras v3)     │
                             └──────────────────────┘
```

### Why a Vercel Edge Proxy?

Direct browser-to-API calls expose the `SARVAM_API_KEY` in client-side code and risk CORS rejections. A thin Vercel Edge Function (`/api/chat.ts`) forwards requests server-side, keeping credentials in environment variables and ensuring CORS headers are set correctly. This is standard practice for any production developer portal.

### Component Tree

```
<App>
  └── <Playground>
        ├── <InputPanel>
        │     ├── <ModeToggle>       (Text ↔ Audio)
        │     ├── <TextInput>        (textarea)
        │     └── <AudioRecorder>    (MediaRecorder + waveform)
        ├── <MetricsBar>             (live token count + tokens/sec)
        ├── <OutputPanel>            (streamed token display)
        └── <ErrorBanner>            (error state, preserved partial output)
```

### State Management

All state is local — no Redux or Zustand needed. The key piece is a single `useStreamingInference` custom hook that encapsulates the entire lifecycle: fetch, stream, decode, count, error.

```ts
// Simplified hook signature
const {
  output,         // string — accumulated streamed text so far
  tokenCount,     // number — live count
  tokensPerSec,   // number — recalculated every chunk
  isStreaming,    // boolean
  error,          // StreamError | null
  run,            // (prompt: string) => void
  abort,          // () => void
} = useStreamingInference();
```

---

## Feature 1 — Multi-Modal Input

Users toggle between Text and Audio input via a segmented control at the top of the input panel. The toggle is keyboard-accessible (Tab to focus, Arrow keys to switch).

### Text Mode

A resizable `<textarea>` with label, placeholder, character count, and a Submit button. Pressing `Enter` (without `Shift`) submits; `Shift+Enter` inserts a newline.

### Audio Mode

Audio recording is handled natively in the browser using the `MediaRecorder` API — no external libraries.

**Recording flow:**

1. User clicks "Record" (or presses `Space` when the button is focused).
2. `MediaRecorder` captures mic input as a `WebM/Opus` blob.
3. A live waveform is drawn on a `<canvas>` element using `AnalyserNode` from the Web Audio API.
4. On "Stop", the blob is sent to the Vercel proxy at `/api/transcribe`, which calls **Sarvam Saaras v3** (`POST /v1/speech-to-text`).
5. The returned transcript is placed into the text field and submitted automatically.

```ts
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
const chunks: BlobPart[] = [];

recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const transcript = await transcribe(blob); // → Saaras v3
  submitPrompt(transcript);
};
```

**Why Saaras v3 over Saarika?** Saaras v3 supports `transcribe`, `translate`, `codemix`, and `verbatim` output modes, making it the correct choice for a multilingual developer portal. Saarika is a legacy model being deprecated.

---

## Feature 2 — Streaming Responses

This is the core engineering requirement. Responses stream token-by-token using the Fetch API and `ReadableStream`. The UI renders each chunk as it arrives — there is no buffering, no wait for the full response.

### API Call

```ts
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'sarvam-m',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  }),
  signal: abortController.signal, // for abort support
});
```

Sarvam's `/v1/chat/completions` with `stream: true` returns **Server-Sent Events (SSE)** — the same format as OpenAI's streaming API. Each event looks like:

```
data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}

data: [DONE]
```

### Stream Processing

```ts
const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const raw = decoder.decode(value, { stream: true });
  const lines = raw.split('\n').filter(l => l.startsWith('data: '));

  for (const line of lines) {
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') return;

    const parsed = JSON.parse(payload);
    const token = parsed.choices?.[0]?.delta?.content ?? '';
    if (token) onToken(token); // → appends to output, updates metrics
  }
}
```

**Key decisions:**
- `TextDecoder` is used with `{ stream: true }` to handle multi-byte characters (Devanagari, Tamil, etc.) that may be split across chunks.
- The output is appended character-by-character using a React state updater function (`prev => prev + token`) to avoid stale closure issues.
- No `setTimeout` or artificial delays — tokens render the instant they arrive from the network.

---

## Feature 3 — Live Metrics

Both metrics are computed inside the `onToken` callback and update on every chunk.

### Token Counter

```ts
// Approximation: split on whitespace boundaries
// Real tokenization would require running the model's tokenizer client-side
setTokenCount(prev => prev + token.split(/\s+/).filter(Boolean).length);
```

Note: This is a word-count approximation. True token counts require the model's BPE tokenizer, which is not exposed client-side. The display labels this as "~tokens" to be transparent about the approximation.

### Tokens Per Second

```ts
const startTime = useRef<number>(0);

// On first token:
if (tokenCount === 0) startTime.current = Date.now();

// On every subsequent token:
const elapsed = (Date.now() - startTime.current) / 1000;
setTokensPerSec(elapsed > 0 ? tokenCount / elapsed : 0);
```

Both metrics reset when a new prompt is submitted. They are displayed in a fixed `<MetricsBar>` above the output panel, updating continuously during streaming. Numbers are rounded to integers (token count) and one decimal place (tokens/sec) to avoid floating-point noise.

---

## Feature 4 — Error Handling

Mid-stream failures are inevitable in a real inference playground. The implementation follows a strict rule: **never blank the screen, never lose partial output.**

### Error Types Handled

| Error | Detection | Behaviour |
|---|---|---|
| Network drop | `fetch` throws `TypeError` | Preserve partial output, show error banner |
| Model timeout | Custom 30s `AbortSignal` timeout | Abort stream, show timeout message |
| User abort | `abortController.abort()` | Preserve partial output, show "Stopped" state |
| HTTP error (4xx/5xx) | `response.ok === false` | Show status code + message before streaming begins |
| Malformed SSE chunk | `JSON.parse` throws | Skip chunk, continue streaming (non-fatal) |
| Stream interrupted | `reader.read()` rejects | Preserve partial output, show error state |

### Implementation

```ts
// Timeout + user abort combined into one signal
const abortController = new AbortController();
const timeout = setTimeout(() => abortController.abort(), 30_000);

try {
  // ... streaming loop
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') {
    // Could be timeout or user-initiated — check which
    setError({ type: 'aborted', message: userAborted ? 'Stopped.' : 'Request timed out.' });
  } else {
    setError({ type: 'network', message: 'Connection lost. Partial output preserved.' });
  }
  // output state is NOT cleared — partial content stays visible
} finally {
  clearTimeout(timeout);
}
```

### Error UI

The `<ErrorBanner>` appears below the output panel, never replacing it. It shows:
- The error type (network, timeout, stopped)
- A "Retry" button that re-submits the same prompt
- A "Clear" button that resets the session entirely

Partial output remains readable above the banner. The session is never reset unexpectedly.

---

## Feature 5 — Accessibility

The playground meets **WCAG 2.1 Level AA** and is fully operable via keyboard alone.

### Keyboard Navigation

| Action | Keyboard |
|---|---|
| Switch input mode (Text/Audio) | `Tab` to mode toggle, `←` / `→` arrows |
| Submit prompt | `Enter` in textarea (Shift+Enter for newline) |
| Start / stop recording | `Space` when record button is focused |
| Abort active stream | `Escape` |
| Retry after error | `Tab` to Retry button, `Enter` |

All interactive elements are reachable via Tab in a logical reading order. Focus is managed explicitly — after submission, focus moves to the output panel so screen readers announce incoming tokens.

### ARIA Implementation

```tsx
{/* Mode toggle — uses radiogroup pattern */}
<div role="radiogroup" aria-label="Input mode">
  <button role="radio" aria-checked={mode === 'text'} onClick={() => setMode('text')}>
    Text
  </button>
  <button role="radio" aria-checked={mode === 'audio'} onClick={() => setMode('audio')}>
    Audio
  </button>
</div>

{/* Output panel — live region for screen reader announcements */}
<div
  role="log"
  aria-live="polite"
  aria-label="Model response"
  aria-busy={isStreaming}
>
  {output}
</div>

{/* Metrics — not announced per-update (too noisy), readable on demand */}
<div aria-label="Live metrics" aria-live="off">
  <span>~{tokenCount} tokens</span>
  <span>{tokensPerSec.toFixed(1)} tok/s</span>
</div>

{/* Error banner */}
<div role="alert" aria-live="assertive">
  {error?.message}
</div>
```

**Key decisions:**
- `aria-live="polite"` on the output panel lets content stream in without interrupting active screen reader narration mid-sentence.
- `role="alert"` on the error banner uses `assertive` politeness so errors are announced immediately.
- `aria-busy={isStreaming}` signals to assistive technology that the output region is actively updating.
- The record button uses `aria-pressed` to convey recording state.
- Colour is never the sole indicator of state — error states use an icon + text, not just a red colour.

### Colour Contrast

All text meets WCAG AA contrast ratios:
- Body text: minimum 4.5:1 against background
- Large text and UI components: minimum 3:1
- Error state: red-700 on white = 5.9:1 ✓
- Focus ring: 3px solid, distinct from adjacent colours

---

## Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | React + TypeScript | Type safety for streaming state machines; team standard |
| Build tool | Vite | Fast HMR, native ESM, trivial Vercel deployment |
| Styling | Tailwind CSS | Utility-first, no runtime overhead, easy dark mode |
| Audio | `MediaRecorder` + Web Audio API | Native browser APIs, zero dependencies |
| ASR | Sarvam Saaras v3 | Best accuracy, supports Indian languages + codemix |
| Chat model | `sarvam-m` (configurable) | Sensible default; engineers can switch via UI |
| Proxy | Vercel Edge Functions | Keeps API key server-side, eliminates CORS issues |
| State | React `useState` + `useRef` | No global state needed; streaming is inherently local |

---

## Folder Structure

```
src/
├── api/
│   ├── chat.ts          # Fetch + ReadableStream wrapper
│   └── transcribe.ts    # Audio blob → Saaras STT
├── components/
│   ├── Playground.tsx   # Root component
│   ├── InputPanel.tsx   # Text + audio input
│   ├── ModeToggle.tsx   # Text ↔ Audio switch
│   ├── AudioRecorder.tsx # MediaRecorder + waveform
│   ├── MetricsBar.tsx   # Live token count + tok/s
│   ├── OutputPanel.tsx  # Streamed token display
│   └── ErrorBanner.tsx  # Error state UI
├── hooks/
│   └── useStreamingInference.ts  # Core streaming hook
└── types/
    └── index.ts         # StreamError, InferenceState, etc.

api/                     # Vercel Edge Functions
├── chat.ts              # Proxy → Sarvam /v1/chat/completions
└── transcribe.ts        # Proxy → Sarvam /v1/speech-to-text
```

---

## Environment Variables

```env
# .env.local (never committed)
SARVAM_API_KEY=sk_...

# Vercel dashboard → Environment Variables
SARVAM_API_KEY=sk_...
```

The client never sees the API key. All requests go through the `/api/*` edge functions.
