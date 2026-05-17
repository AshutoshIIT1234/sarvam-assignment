export type EditType = 'equal' | 'insert' | 'delete'

export interface Edit {
  type: EditType
  tokenA?: string
  tokenB?: string
}

export function myersDiff(tokensA: string[], tokensB: string[]): Edit[] {
  const n = tokensA.length
  const m = tokensB.length
  const max = n + m

  if (n === 0) return tokensB.map(t => ({ type: 'insert' as EditType, tokenB: t }))
  if (m === 0) return tokensA.map(t => ({ type: 'delete' as EditType, tokenA: t }))

  const v: Map<number, number> = new Map()
  v.set(1, 0)
  const trace: Map<number, number>[] = []

  for (let d = 0; d <= max; d++) {
    const snapshot = new Map(v)
    trace.push(snapshot)

    for (let k = -d; k <= d; k += 2) {
      let x: number

      const down = v.get(k - 1) ?? -1
      const right = v.get(k + 1) ?? -1

      if (k === -d || (k !== d && down < right)) {
        x = right
      } else {
        x = down + 1
      }

      let y = x - k

      while (x < n && y < m && tokensA[x] === tokensB[y]) {
        x++
        y++
      }

      v.set(k, x)

      if (x >= n && y >= m) {
        return backtrack(trace, tokensA, tokensB, d)
      }
    }
  }

  return []
}

function backtrack(
  trace: Map<number, number>[],
  a: string[],
  b: string[],
  d: number
): Edit[] {
  const result: Edit[] = []
  let x = a.length
  let y = b.length

  for (let i = d; i > 0; i--) {
    const v = trace[i]
    const getV = (k: number) => v.get(k) ?? 0

    const k = x - y

    let moveType: 'delete' | 'insert'
    let prevK: number
    let prevX: number

    if (k === -i) {
      moveType = 'insert'
      prevK = k + 1
      prevX = getV(prevK)
    } else if (k === i) {
      moveType = 'delete'
      prevK = k - 1
      prevX = getV(prevK) + 1
    } else {
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

    while (x > prevX && y > prevY) {
      result.unshift({ type: 'equal', tokenA: a[x - 1], tokenB: b[y - 1] })
      x--
      y--
    }

    if (moveType === 'delete') {
      result.unshift({ type: 'delete', tokenA: a[x - 1] })
      x--
    } else {
      result.unshift({ type: 'insert', tokenB: b[y - 1] })
      y--
    }
  }

  while (x > 0 && y > 0) {
    result.unshift({ type: 'equal', tokenA: a[x - 1], tokenB: b[y - 1] })
    x--
    y--
  }

  return result
}