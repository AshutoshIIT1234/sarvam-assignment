# Sarvam AI — Frontend Intern Assignment Submission

**Submitted by:** Ashutosh Kumar Tripathi
**Date:** 17 May 2026

---

## Links

| | |
|---|---|
| **GitHub Repository** | [https://github.com/YOUR_USERNAME/servam](https://github.com/YOUR_USERNAME/servam) |
| **Live Demo (Vercel)** | [https://servam.vercel.app](https://servam.vercel.app) |
| **3-Min Walkthrough Video** | [https://www.loom.com/share/YOUR_VIDEO_ID](https://www.loom.com/share/YOUR_VIDEO_ID) |

---

## Part A — Inference Playground

### Architecture

I kept the component tree deliberately shallow. A single `Playground` component orchestrates four focused sub-components, each responsible for exactly one concern:

| Component | Responsibility |
|---|---|
| `InputPanel` | Hosts the text/audio mode toggle. Conditionally renders `TextInput` or `AudioRecorder`. |
| `OutputPanel` | Renders streaming output with lightweight inline markdown parsing (bold, italic, inline code). |
| `MetricsBar` | Shows live token count and tokens/sec, updating on every token arrival. |
| `ErrorBanner` | Displays typed error states (network / timeout / aborted / http) with retry and clear actions. |

All state and streaming logic live in a custom hook `useStreamingInference`, so the components themselves stay presentational and easy to test in isolation. This also means swapping the inference backend later only requires touching the hook.

```
App
├── Playground
│   ├── InputPanel → TextInput | AudioRecorder
│   ├── MetricsBar
│   ├── OutputPanel
│   └── ErrorBanner
└── DiffView
```

---

### Streaming Implementation

I went with the native **Fetch API + ReadableStream** — no wrapper libraries. The main reason is control: I needed to handle partial chunks, a dangling buffer, and mid-stream aborts cleanly, and the native API makes that straightforward without pulling in extra dependencies.

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

Tokens are yielded one at a time and appended to output state — the UI never waits for a full response before showing something.

---

### Multi-Modal Input

**Text mode** accepts a textarea with `Enter` to submit and `Shift+Enter` for newlines.

**Audio mode** uses the browser's `MediaRecorder` API with an `AudioContext` waveform visualiser. The recorded `audio/webm` blob is sent to Sarvam's speech-to-text endpoint (`saaras:v3`), and the returned transcript is automatically submitted to the inference stream.

---

### Live Metrics

Token count is approximated by splitting each yielded chunk on whitespace. Tokens/sec is calculated as `tokenCount / elapsedSeconds` and recalculated on every token arrival, so the number stays accurate throughout the stream rather than being a snapshot at the end.

---

### Error Handling

The guiding principle here was: **never blank the screen**. Output state only ever appends — errors appear alongside existing partial output, not instead of it. Each error type gets a distinct message so the user understands what happened:

| Error type | Trigger | Behaviour |
|---|---|---|
| `network` | `fetch()` throws | Partial output preserved, error banner shown |
| `timeout` | 30s `AbortController` fires | Stream aborted, timeout message shown |
| `aborted` | User presses Esc or clicks Stop | Partial output kept, "Stopped" shown |
| `http` | Non-2xx response | Status code shown, retry available |

Audio errors (mic permission denial, transcription failures) surface inline in the input panel so they don't interfere with any output already on screen.

---

### `<think>` Tag Stripping

The Sarvam model occasionally emits `<think>...</think>` reasoning blocks. These are stripped inside the streaming hook before anything reaches the output panel. Three cases are covered: a complete block, a block where the opening tag was cut off by chunk boundaries, and an in-progress block at the end of the stream:

```ts
return raw
  .replace(/<think>[\s\S]*?<\/think>\n?/gi, '')  // complete block
  .replace(/^[\s\S]*?<\/think>\n?/, '')           // missing opening tag
  .replace(/<think>[\s\S]*$/i, '')                // in-progress block
  .trimStart()
```

---

### Accessibility

| Concern | Implementation |
|---|---|
| Screen reader output | `role="log"` + `aria-live="polite"` + `aria-busy` on `OutputPanel` |
| Error announcements | `role="alert"` + `aria-live="assertive"` on `ErrorBanner` |
| Metrics updates | `aria-live="polite"` + `aria-atomic="true"` on `MetricsBar` |
| Keyboard stop | `Esc` aborts the stream for keyboard-only users |
| Audio toggle | `Space` key toggles recording when the button is focused |
| Mode switch toggle | `role="radiogroup"` + `role="radio"` + `aria-checked` on `InputPanel` |
| Focus management | Output panel receives focus when a response begins |
| Colour contrast | All pairs ≥ 4.5:1 (WCAG AA); purple `#a78bfa` on dark `#111118` |
| Focus indicators | `focus:ring-2` visible on all interactive elements (WCAG 2.4.7) |
| Labels | Every form input has an associated `<label>` element |

---

## Part B — Model Output Diff View

### Diffing Algorithm: Myers Diff (Token-Level)

Okay, I'll be honest — when I first read the requirement and saw "LCS, Myers diff, other approaches", I only recognised LCS. I'd solved it as a DSA problem before, so that one clicked immediately. Myers and the others? Blank.

But that's exactly when something clicked for me — **this is a DSA problem**. The diff view is literally asking: given two sequences of tokens, what's the minimum number of changes to get from one to the other? That's edit distance. That's a classic. So instead of guessing, I went deep — read through each algorithm, understood the *why* behind each one, not just the *what*. And that's how I landed on Myers.

Myers diff finds the **shortest edit script** — the minimum insertions and deletions to transform token sequence A into token sequence B. It models this as a graph problem: moving right = insert a token from B, moving down = delete from A, moving diagonally = tokens match. The goal is finding the shortest diagonal path through this graph.

```ts
// Simplified core loop — src/utils/myers.ts
for (let d = 0; d <= max; d++) {
  for (let k = -d; k <= d; k += 2) {
    // Choose: come from k-1 (delete) or k+1 (insert)
    let x = (k === -d || (k !== d && v[k-1] < v[k+1]))
      ? v[k+1]        // insert — x stays the same
      : v[k-1] + 1    // delete — x advances

    let y = x - k

    // Extend diagonal for free (equal tokens)
    while (x < n && y < m && tokensA[x] === tokensB[y]) { x++; y++ }

    v[k] = x
    if (x >= n && y >= m) return backtrack(trace, tokensA, tokensB, d)
  }
}
```

---

### Paraphrase Detection

After Myers produces the raw edit script, adjacent `delete`+`insert` pairs are checked for semantic similarity using a lookup table of known synonyms with a Jaccard character similarity fallback. Pairs scoring above **0.80** are marked `paraphrased` (highlighted yellow) rather than shown as a raw deletion and insertion. This makes the diff much cleaner to read when the model rephrases rather than restructures:

```
"car"  → "vehicle"   sim: 0.92  → paraphrased ✓
"fast" → "quick"     sim: 0.94  → paraphrased ✓
"good" → "great"     sim: 0.88  → paraphrased ✓
```

---

### Time Complexity

| Step | Complexity |
|---|---|
| Myers diff | O((N+M) × D) time, O((N+M) × D) space for the trace |
| Tokenisation | O(N) |
| Paraphrase check | O(D) — only runs on edit pairs |
| **Overall** | **O((N+M) × D) where D = edit distance** |

Best case (identical outputs): D=0, so effectively O(N+M). Worst case (completely different): D=N+M, giving O((N+M)²). In practice, model outputs on the same prompt sit very close to the best case.

---

### Why Myers Over Alternatives

**vs LCS (Longest Common Subsequence)**

LCS finds the longest matching subsequence but doesn't directly give you a minimal edit script. Standard LCS is O(N×M) time and space. For large outputs that's expensive, and Myers beats it handily in the common case where D is small.

**vs Naive DP**

Same problem — O(N×M) space is prohibitive for long outputs. Myers uses O(N+M) for the forward pass, which is a meaningful difference at scale.

**vs Patience Diff**

Patience diff anchors on unique lines, which works well for source code. For token-level text comparison, common words like "the", "a", "is" appear everywhere and make those anchors unreliable. Myers doesn't depend on uniqueness.

**Why Myers, finally**

Two model outputs on the same prompt are almost always very similar — small D. Myers runs in O((N+M)×D), which is nearly linear in that case. It also gives you the **guaranteed minimum edit distance** — not just any diff, the cleanest possible one. For a UI where someone is trying to spot exactly what changed between two model versions, that matters. A noisy diff with unnecessary highlights defeats the whole purpose.

---

## Part B — Q1 Bug Report

Honestly, when I first read the deliverables and saw "Q1 bug report", I was confused — the assignment didn't mention any existing buggy component to fix. I sat with that for a bit. Then it hit me: I had faced a real bug while building this. And that's probably what they meant.

### The Bug

I wrote the Myers algorithm with help from documentation and references, got it running, and it was producing output. But when I looked at the diff view in the browser — **nothing was highlighted**. Changed tokens were just rendering as plain text, same colour as everything else. The algorithm was working correctly, but the UI had no idea what to do with the result.

### Root Cause

The diff function was returning an array of token objects like `{ type: 'added' | 'deleted' | 'equal', value: string }`, but the rendering component was just mapping over them and joining the `.value` strings — completely ignoring the `type` field. So the edit script was correct, the data was all there, it just never reached the UI.

### Fix

Each token object now drives its own styled `<span>` — added tokens get a green background, deleted get red with strikethrough, paraphrased get yellow, and equal tokens render plain. Once the renderer actually consumed the `type` field instead of discarding it, the highlighting worked exactly as expected.

---

## Summary

### Error Handling Strategy

| Principle | Implementation |
|---|---|
| Never blank the screen | Output state only appends — errors appear alongside existing output |
| Typed errors | `network / timeout / aborted / http` each have distinct messages |
| Retry | Re-runs the last prompt without clearing existing output |
| Abort | `AbortController` cleanly cancels the fetch; partial output is kept |
| Audio errors | Surface inline in input panel — don't affect the output area |

### Accessibility Summary

| Concern | Implementation |
|---|---|
| Screen reader output | `role="log"` + `aria-live="polite"` on `OutputPanel` |
| Error announcements | `role="alert"` + `aria-live="assertive"` on `ErrorBanner` |
| Metrics updates | `aria-live="polite"` + `aria-atomic="true"` on `MetricsBar` |
| Keyboard stop | `Esc` to abort stream |
| Input mode toggle | `role="radiogroup"` + `aria-checked` |
| Focus management | Output panel receives focus when response begins |
| Colour contrast | All text/background pairs ≥ 4.5:1 (WCAG AA) |
| Focus indicators | `focus:ring-2` on all interactive elements |

---

*Thank you for the opportunity — happy to walk through any part of this in more detail.*
