Situation (Context):
Company X ka developer portal jisme enterprise engineers:

Browser-based playground mein on-device inference test kar sakein
Diff view se model outputs inspect kar sakein
UI se fleet mein model updates configure aur deploy kar sakein

Part A — Inference Playground

Multi-modal input (Text + Audio toggle)
Streaming responses (Fetch API + ReadableStream, token-by-token)
Live Metrics (token counter + tokens/sec)
Error Handling (partial output preserve, clear error state)
Accessibility (WCAG AA, keyboard navigable)

Part B — Model Output Diff View

Side-by-side comparison
Token-level diffing (NOT line-level)
Core diff algo khud banana hai (no external libraries)
Written explanation: algo, time complexity, why over LCS/Myers

Deliverables:

Single PDF with GitHub + Vercel link + 3-min video + explanations
Deadline: 19 May, 5pm IST


Ab Soch
Situation mein 3 cheezein hain. Assignment mein sirf Part A aur Part B explicitly diya hai. Fleet deployment UI ka koi Part C nahi hai.
Lekin tera point valid hai — context diya hai toh flavor toh lena chahiye.

Revised Plan
What We Build
Developer Portal (shell)
├── Tab 1: Inference Playground     ← Part A (fully built)
├── Tab 2: Model Output Diff View   ← Part B (fully built)
└── Tab 3: Fleet Management UI      ← Situation context, basic UI shell
                                       (non-functional, but visually present)
Tab 3 ko fully functional banana zaruri nahi — but agar portal jaisa feel dena hai toh ek skeleton UI banana samajh aata hai. Reviewer dekhega ki tune pura context absorb kiya.

Revised Project Structure
sarvam-playground/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx               ← Developer Portal header
│   │   │   └── TabNav.tsx               ← 3 tabs navigation
│   │   │
│   │   ├── playground/                  ← Part A
│   │   │   ├── InferencePlayground.tsx
│   │   │   ├── TextInput.tsx
│   │   │   ├── AudioInput.tsx
│   │   │   ├── StreamingOutput.tsx
│   │   │   ├── LiveMetrics.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   │
│   │   ├── diff/                        ← Part B
│   │   │   ├── DiffView.tsx
│   │   │   ├── DiffToken.tsx
│   │   │   └── PromptInput.tsx
│   │   │
│   │   └── fleet/                       ← Situation context (UI shell)
│   │       ├── FleetDashboard.tsx
│   │       ├── ModelCard.tsx
│   │       └── DeployModal.tsx
│   │
│   ├── hooks/
│   │   ├── useStream.ts                 ← Fetch + ReadableStream
│   │   └── useMetrics.ts                ← token/sec calculation
│   │
│   ├── utils/
│   │   └── diff.ts                      ← Custom LCS algorithm
│   │
│   └── App.tsx

3-Day Action Plan
Day 1 — Today (16 May)

 Scaffold project (Vite + React + TypeScript + Tailwind)
 Layout shell — Navbar + 3 Tab navigation
 useStream.ts hook — Fetch API + ReadableStream
 useMetrics.ts hook — token counter + tokens/sec
 StreamingOutput.tsx + LiveMetrics.tsx

Day 2 — 17 May

 TextInput.tsx + AudioInput.tsx (toggle between modes)
 Error handling — partial output preserve, error state UI
 Accessibility — keyboard nav, ARIA labels, WCAG AA
 diff.ts — Custom LCS algorithm (no libraries)
 DiffView.tsx + DiffToken.tsx — side-by-side, token-level highlights

Day 3 — 18 May

 FleetDashboard.tsx — skeleton UI (model cards, deploy button, status badges)
 Polish overall UI — developer portal feel
 Deploy to Vercel
 Record 3-min walkthrough video
 Write PDF — architecture, diff algo explanation, complexity, accessibility, error handling