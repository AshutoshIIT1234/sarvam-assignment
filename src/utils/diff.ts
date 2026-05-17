import { myersDiff } from './myers'
import { semanticSimilarity, PARAPHRASE_THRESHOLD } from './semanticSimilarity'

export type DiffState = 'equal' | 'added' | 'deleted' | 'paraphrased'

export interface DiffToken {
  state: DiffState
  tokenA?: string
  tokenB?: string
  similarity?: number
}

export function tokenize(text: string): string[] {
  return text.match(/\w+|[^\w\s]/g) ?? []
}

export function computeTokenDiff(textA: string, textB: string): DiffToken[] {
  const tokensA = tokenize(textA)
  const tokensB = tokenize(textB)

  if (tokensA.length === 0 && tokensB.length === 0) {
    return []
  }

  if (tokensA.length === 0) {
    return tokensB.map(token => ({ state: 'added' as DiffState, tokenB: token }))
  }

  if (tokensB.length === 0) {
    return tokensA.map(token => ({ state: 'deleted' as DiffState, tokenA: token }))
  }

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

    if (
      edit.type === 'delete' &&
      i + 1 < edits.length &&
      edits[i + 1].type === 'insert'
    ) {
      const tokenA = edit.tokenA!
      const tokenB = edits[i + 1].tokenB!
      const sim = semanticSimilarity(tokenA, tokenB)

      if (sim >= PARAPHRASE_THRESHOLD) {
        result.push({ state: 'paraphrased', tokenA, tokenB, similarity: sim })
      } else {
        result.push({ state: 'deleted', tokenA })
        result.push({ state: 'added', tokenB })
      }
      i += 2
      continue
    }

    if (edit.type === 'delete') {
      result.push({ state: 'deleted', tokenA: edit.tokenA })
    } else {
      result.push({ state: 'added', tokenB: edit.tokenB })
    }
    i++
  }

  return result
}

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

export function changeScore(tokens: DiffToken[]): number {
  const total = tokens.filter(t => t.state !== 'equal').length
  return total > 0 ? Math.round((total / tokens.length) * 100) : 0
}