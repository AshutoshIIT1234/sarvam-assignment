/**
 * Myers Diff Algorithm — implemented from scratch, no libraries.
 *
 * The idea: given two token sequences A and B, find the shortest edit script
 * (minimum insertions + deletions) to transform A into B.
 *
 * I think of it as a path-finding problem on an edit graph:
 *   - Moving right  = insert a token from B
 *   - Moving down   = delete a token from A
 *   - Moving diag   = tokens match (free move)
 *
 * Myers finds the shortest diagonal path through this graph in O((N+M)·D) time,
 * where D is the edit distance. For model outputs that are mostly similar,
 * D is small, so this runs nearly linearly — much better than naive O(N·M) LCS.
 *
 * The algorithm runs in two phases:
 *   1. Forward pass — find the minimum D and record the "trace" (snapshots of V at each D)
 *   2. Backtrack — walk the trace in reverse to reconstruct the actual edit sequence
 */

export type EditType = 'equal' | 'insert' | 'delete'

export interface Edit {
  type: EditType
  tokenA?: string
  tokenB?: string
}

export function myersDiff(tokensA: string[], tokensB: string[]): Edit[] {
  const n = tokensA.length
  const m = tokensB.length
  const max = n + m // worst case: delete everything and insert everything

  // Edge cases — one side is empty
  if (n === 0) return tokensB.map((t) => ({ type: 'insert' as EditType, tokenB: t }))
  if (m === 0) return tokensA.map((t) => ({ type: 'delete' as EditType, tokenA: t }))

  // V maps diagonal k → furthest x reached on that diagonal
  // We start at k=1, x=0 (a dummy value so the first step works correctly)
  const v: Map<number, number> = new Map()
  v.set(1, 0)

  // trace[d] = snapshot of V after exploring all paths of length d
  // We need this to backtrack the actual edit sequence later
  const trace: Map<number, number>[] = []

  for (let d = 0; d <= max; d++) {
    // Save a snapshot of V before this round of exploration
    trace.push(new Map(v))

    // Explore all diagonals reachable in exactly d edits
    // Diagonals are always even or odd together, so we step by 2
    for (let k = -d; k <= d; k += 2) {
      let x: number

      const down = v.get(k - 1) ?? -1 // x if we came from diagonal k-1 (delete)
      const right = v.get(k + 1) ?? -1 // x if we came from diagonal k+1 (insert)

      // Choose the move that gets us furthest along x
      // Prefer insert (right) when both are equal — produces cleaner diffs
      if (k === -d || (k !== d && down < right)) {
        x = right // came from k+1 via insert — x stays the same
      } else {
        x = down + 1 // came from k-1 via delete — x advances
      }

      let y = x - k // y is always derived from x and the diagonal k

      // Extend diagonally as far as possible — matching tokens are free
      while (x < n && y < m && tokensA[x] === tokensB[y]) {
        x++
        y++
      }

      v.set(k, x)

      // If we've consumed both sequences, we found the shortest edit script
      if (x >= n && y >= m) {
        return backtrack(trace, tokensA, tokensB, d)
      }
    }
  }

  // Should never reach here for finite inputs
  return []
}

/**
 * Walk the trace backwards from (n, m) to (0, 0) to reconstruct the edit sequence.
 * At each step we figure out which move was made (insert or delete) and record it,
 * then slide diagonally over any equal tokens that preceded it.
 */
function backtrack(trace: Map<number, number>[], a: string[], b: string[], d: number): Edit[] {
  const result: Edit[] = []
  let x = a.length
  let y = b.length

  for (let i = d; i > 0; i--) {
    const v = trace[i]
    const getV = (k: number) => v.get(k) ?? 0

    const k = x - y // current diagonal

    let moveType: 'delete' | 'insert'
    let prevK: number
    let prevX: number

    if (k === -i) {
      // We must have come from an insert (only option at the left boundary)
      moveType = 'insert'
      prevK = k + 1
      prevX = getV(prevK)
    } else if (k === i) {
      // We must have come from a delete (only option at the right boundary)
      moveType = 'delete'
      prevK = k - 1
      prevX = getV(prevK) + 1
    } else {
      // In the middle — figure out which move got us here
      const fromDelete = getV(k - 1) + 1
      const fromInsert = getV(k + 1)

      if (fromDelete > fromInsert) {
        moveType = 'delete'
        prevK = k - 1
        prevX = fromDelete
      } else if (fromInsert > fromDelete) {
        moveType = 'insert'
        prevK = k + 1
        prevX = fromInsert
      } else {
        // Tie-break: prefer insert to keep deletions and insertions grouped
        const deleteCandidate = getV(k - 1) + 1
        const insertCandidate = getV(k + 1)

        if (deleteCandidate === insertCandidate && deleteCandidate === x) {
          moveType = 'insert'
          prevK = k + 1
          prevX = insertCandidate
        } else if (deleteCandidate > insertCandidate) {
          moveType = 'delete'
          prevK = k - 1
          prevX = deleteCandidate
        } else {
          moveType = 'insert'
          prevK = k + 1
          prevX = insertCandidate
        }
      }
    }

    const prevY = prevX - prevK

    // Any diagonal movement between prevX and x means equal tokens — record them
    while (x > prevX && y > prevY) {
      result.unshift({ type: 'equal', tokenA: a[x - 1], tokenB: b[y - 1] })
      x--
      y--
    }

    // Record the actual edit that caused this step
    if (moveType === 'delete') {
      result.unshift({ type: 'delete', tokenA: a[x - 1] })
      x--
    } else {
      result.unshift({ type: 'insert', tokenB: b[y - 1] })
      y--
    }
  }

  // Any remaining diagonal movement at the start of the sequences
  while (x > 0 && y > 0) {
    result.unshift({ type: 'equal', tokenA: a[x - 1], tokenB: b[y - 1] })
    x--
    y--
  }

  return result
}
