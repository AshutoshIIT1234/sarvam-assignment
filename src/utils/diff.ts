/**
 * Token-level diff utilities.
 *
 * This is the layer between the raw Myers algorithm and the UI.
 * It tokenizes text, runs the diff, then does a second pass to detect
 * "paraphrased" pairs — adjacent delete+insert where the two tokens
 * are semantically similar (e.g. "car" → "vehicle").
 *
 * That paraphrase detection is what makes this diff feel smart rather
 * than just marking every word substitution as a hard delete+add.
 */
import { myersDiff } from './myers'
import { semanticSimilarity, PARAPHRASE_THRESHOLD } from './semanticSimilarity'

export type DiffState = 'equal' | 'added' | 'deleted' | 'paraphrased'

export interface DiffToken {
  state: DiffState
  tokenA?: string
  tokenB?: string
  similarity?: number // only present for paraphrased tokens
}

/**
 * Split text into tokens: words and punctuation separately.
 * I keep punctuation as its own token so "hello," and "hello" don't mismatch.
 */
export function tokenize(text: string): string[] {
  return text.match(/\w+|[^\w\s]/g) ?? []
}

/**
 * The main diff function. Tokenizes both texts, runs Myers diff,
 * then promotes adjacent delete+insert pairs to "paraphrased" when
 * the two tokens are semantically close enough.
 */
export function computeTokenDiff(textA: string, textB: string): DiffToken[] {
  const tokensA = tokenize(textA)
  const tokensB = tokenize(textB)

  // Short-circuit for empty inputs
  if (tokensA.length === 0 && tokensB.length === 0) return []
  if (tokensA.length === 0) return tokensB.map((token) => ({ state: 'added' as DiffState, tokenB: token }))
  if (tokensB.length === 0) return tokensA.map((token) => ({ state: 'deleted' as DiffState, tokenA: token }))

  const edits = myersDiff(tokensA, tokensB)
  const result: DiffToken[] = []

  let i = 0
  while (i < edits.length) {
    const edit = edits[i]

    if (edit.type === 'equal') {
      result.push({ state: 'equal', tokenA: edit.tokenA, tokenB: edit.tokenB })
      i++
      continue
    }

    // Look ahead: if a delete is immediately followed by an insert,
    // check if they're semantically similar before deciding how to label them
    if (edit.type === 'delete' && i + 1 < edits.length && edits[i + 1].type === 'insert') {
      const tokenA = edit.tokenA ?? ''
      const tokenB = edits[i + 1].tokenB ?? ''
      const sim = semanticSimilarity(tokenA, tokenB)

      if (sim >= PARAPHRASE_THRESHOLD) {
        // Close enough — treat as a paraphrase rather than a hard swap
        result.push({ state: 'paraphrased', tokenA, tokenB, similarity: sim })
      } else {
        // Too different — show as separate delete + add
        result.push({ state: 'deleted', tokenA })
        result.push({ state: 'added', tokenB })
      }
      i += 2 // consumed two edits
      continue
    }

    // Plain delete or insert with no paraphrase candidate
    if (edit.type === 'delete') {
      result.push({ state: 'deleted', tokenA: edit.tokenA })
    } else {
      result.push({ state: 'added', tokenB: edit.tokenB })
    }
    i++
  }

  return result
}

/** Count added, removed, and paraphrased tokens for the summary bar */
export function getSummary(diff: DiffToken[]): { added: number; removed: number; paraphrased: number } {
  return diff.reduce(
    (acc, token) => {
      if (token.state === 'added') acc.added++
      else if (token.state === 'deleted') acc.removed++
      else if (token.state === 'paraphrased') acc.paraphrased++
      return acc
    },
    { added: 0, removed: 0, paraphrased: 0 }
  )
}

/**
 * Returns a 0–100 "change score" — what percentage of tokens are different.
 * Useful as a quick at-a-glance similarity metric between the two outputs.
 */
export function changeScore(tokens: DiffToken[]): number {
  const total = tokens.filter((t) => t.state !== 'equal').length
  return total > 0 ? Math.round((total / tokens.length) * 100) : 0
}
