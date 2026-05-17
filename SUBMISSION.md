# Sarvam Frontend Intern Assignment — Submission

**Submitted by:** [Your Name]
**Date:** 17 May 2026

---

## Links

| | |
|---|---|
| **GitHub Repository** | [https://github.com/YOUR_USERNAME/servam](https://github.com/YOUR_USERNAME/servam) |
| **Live Demo (Vercel)** | [https://servam.vercel.app](https://servam.vercel.app) |
| **3-Minute Walkthrough Video** | [https://www.loom.com/share/YOUR_VIDEO_ID](https://www.loom.com/share/YOUR_VIDEO_ID) |

---

## Part A — Inference Playground

### Architecture Decisions

The playground is built as a single `Playground` component that composes four focused sub-components:

- **`InputPanel`** — hosts the mode toggle and conditionally renders `TextInput` or `AudioRecorder`
- **`OutputPanel`** — renders streaming output with inline markdown parsing (`**bold**`, `*italic*`, `` `code` ``)
- **`MetricsBar`** — displays live token count and tokens/sec
- **`ErrorBanner`** — shows typed error state with retry/clear actions

State and streaming logic live entirely in `useStreamingInference`, keeping components presentational.

```
App
├── Playground
│   ├── InputPanel → TextInput | AudioRecorder
│   ├── MetricsBar
│   ├── OutputPanel
│   └── ErrorBanner
└── DiffView
```

### Streaming Implementation

Streaming uses the native **Fetch API + ReadableStream** — no libraries.

```ts
// src/api/chat.ts
const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') return
    const token = JSON.parse(payload).choices?.[0]?.delta?.content ?? ''
    if (token) yield token
  }
}
```

Tokens are yielded one by one and appended to output state — the UI never waits for the full response.

### Multi-Modal Input

- **Text mode** — textarea with `Enter` to submit, `Shift+Enter` for newline
- **Audio mode** — `MediaRecorder` + `AudioContext` for waveform visualization, sends `audio/webm` blob to Sarvam's `speech-to-text` API (`saaras:v3` model), transcript auto-submits to inference

### Live Metrics

Token count is approximated by splitting on whitespace per yielded chunk. Tokens/sec = `tokenCount / elapsedSeconds`, updated on every token arrival.

### Error Handling

| Error type | Trigger | Behaviour |
|---|---|---|
| `network` | fetch throws | Partial output preserved, error banner shown |
| `timeout` | 30s `AbortController` | Stream aborted, timeout message shown |
| `aborted` | User presses Esc or Stop | Partial output preserved, "Stopped" shown |
| `http` | Non-2xx response | Status code shown, retry available |

Partial output is **never cleared** on error — `setOutput` only appends, errors are shown alongside existing output.

### `<think>` Tag Stripping

The Sarvam model sometimes emits `<think>...</think>` reasoning blocks (with or without the opening tag). These are stripped in the streaming hook before display:

```ts
return raw
  .replace(/<think>[\s\S]*?<\/think>\n?/gi, '')  // complete block
  .replace(/^[\s\S]*?<\/think>\n?/, '')           // missing opening tag
  .replace(/<think>[\s\S]*$/i, '')                // in-progress block
  .trimStart()
```

### Accessibility

- All interactive elements have `focus:ring` outlines (WCAG 2.4.7)
- `InputPanel` mode toggle uses `role="radiogroup"` + `role="radio"` + `aria-checked`
- `OutputPanel` uses `role="log"` + `aria-live="polite"` + `aria-busy`
- `MetricsBar` uses `aria-live="polite"` + `aria-atomic="true"`
- `ErrorBanner` uses `role="alert"` + `aria-live="assertive"`
- `Esc` key aborts streaming (keyboard-only users can stop generation)
- `Space` key toggles audio recording when button is focused
- All form inputs have associated `<label>` elements
- Colour contrast meets WCAG AA (purple `#a78bfa` on dark `#111118` ≥ 4.5:1)

---

## Part B — Model Output Diff View

### Algorithm: Myers Diff (Token-Level)

The core diff algorithm is **Myers diff**, implemented from scratch in `src/utils/myers.ts`. No external diff libraries are used.

Myers diff finds the **shortest edit script** (minimum number of insertions + deletions) to transform sequence A into sequence B. It operates on the edit graph where:
- Moving right = insert a token from B
- Moving down = delete a token from A
- Moving diagonally = tokens match (equal)

The algorithm finds the shortest diagonal path through this graph.

```ts
// Simplified core loop
for (let d = 0; d <= max; d++) {
  for (let k = -d; k <= d; k += 2) {
    // Choose: come from k-1 (delete) or k+1 (insert)
    let x = (k === -d || (k !== d && v[k-1] < v[k+1]))
      ? v[k+1]        // insert
      : v[k-1] + 1    // delete

    let y = x - k
    // Extend diagonal (equal tokens)
    while (x < n && y < m && tokensA[x] === tokensB[y]) { x++; y++ }
    v[k] = x
    if (x >= n && y >= m) return backtrack(trace, tokensA, tokensB, d)
  }
}
```

### Paraphrase Detection

After Myers produces the raw edit script, adjacent `delete`+`insert` pairs are checked for semantic similarity using a lookup table + Jaccard character similarity fallback. Pairs above the 0.80 threshold are marked `paraphrased` (yellow) instead of deleted+added.

```
"car" → "vehicle"   sim: 0.92  → paraphrased ✓
"fast" → "quick"    sim: 0.94  → paraphrased ✓
"good" → "great"    sim: 0.88  → paraphrased ✓
```

### Time Complexity

| | Complexity |
|---|---|
| **Myers diff** | O((N+M)·D) time, O((N+M)·D) space for trace |
| **Tokenization** | O(N) |
| **Paraphrase check** | O(D) — only on edit pairs |
| **Overall** | O((N+M)·D) where D = edit distance |

In the best case (identical texts), D=0 → O(N+M). In the worst case (completely different), D=N+M → O((N+M)²).

### Why Myers over alternatives?

**vs LCS (Longest Common Subsequence):**
LCS finds the longest matching subsequence but doesn't directly produce a minimal edit script. Standard LCS is O(N·M) time and space — worse than Myers for typical cases where D << N+M. Myers is specifically optimised for the "few differences" case common in model output comparison.

**vs Naive LCS/DP:**
O(N·M) space is prohibitive for long outputs. Myers uses O(N+M) space for the forward pass.

**vs Patience diff:**
Patience diff is better for source code (unique lines as anchors) but token-level text has many repeated common words ("the", "a", "is") making patience anchors unreliable.

**Why Myers is the right choice here:**
Model outputs from two versions of the same prompt are typically very similar (small D). Myers runs in O((N+M)·D) — nearly linear when outputs are close. It produces the **minimum edit distance** which gives the cleanest, most readable diff highlighting.

---

## Part B — Q1 Bug Report

**Bug:** The diff view previously rendered a single merged token stream instead of a true side-by-side layout.

**Root cause:** The component rendered one `flex-wrap` container with all tokens interleaved, making it impossible to visually compare the two model outputs independently.

**Fix:** Tokens are now split into two independent streams:
- **Left (Model v1):** `equal` (tokenA) + `deleted` + `paraphrased` (tokenA side)
- **Right (Model v2):** `equal` (tokenB) + `added` + `paraphrased` (tokenB side)

Each stream is rendered in its own column in a `grid-cols-2` layout, giving a true side-by-side comparison as required.

---

## Error Handling Strategy Summary

1. **Never blank the screen** — output state only appends, never resets on error
2. **Typed errors** — `network | timeout | aborted | http` each have distinct messages
3. **Retry** — re-runs the last prompt without clearing existing output first
4. **Abort** — `AbortController` cleanly cancels the fetch; partial output is kept
5. **Audio errors** — microphone permission denial and transcription failures surface inline in the input panel without affecting the output area

---

## Accessibility Considerations Summary

| Concern | Implementation |
|---|---|
| Screen reader output announcements | `role="log"` + `aria-live="polite"` on OutputPanel |
| Error announcements | `role="alert"` + `aria-live="assertive"` on ErrorBanner |
| Metrics updates | `aria-live="polite"` + `aria-atomic="true"` on MetricsBar |
| Keyboard-only streaming control | `Esc` to abort, `Space` on audio button |
| Input mode toggle | `role="radiogroup"` + `aria-checked` |
| Focus management | Output panel receives focus when response begins |
| Colour contrast | All text/background pairs ≥ 4.5:1 (WCAG AA) |
| Visible focus indicators | `focus:ring-2` on all interactive elements |
